import sdk from "@farcaster/frame-sdk"; 
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";
const BASE_CHAIN_ID = 8453;

const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessages() external view returns (tuple(address user, string text, uint256 timestamp)[])"
];

export default function MessageBoard() {
  const [userAddress, setUserAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [messagesList, setMessagesList] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [logs, setLogs] = useState([]); 

  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    console.log(msg);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        if (sdk && sdk.actions) {
            await sdk.actions.ready();
        }
      } catch (e) { console.error(e); }
    };
    init();
    loadMessages(null);
  }, []);

  const getEthProvider = () => {
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) return sdk.wallet.ethProvider;
    if (typeof window !== "undefined" && window.ethereum) return window.ethereum;
    return null;
  };

  async function connectWallet() {
    try {
      const ethProvider = getEthProvider();
      if (!ethProvider) {
        alert("Wallet not found");
        return;
      }
      const provider = new ethers.BrowserProvider(ethProvider);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts[0]) {
        setUserAddress(accounts[0]);
        const bal = await provider.getBalance(accounts[0]);
        setBalance(ethers.formatEther(bal));
        loadMessages(provider);
      }
    } catch (error) {
      addLog("Connect Error: " + error.message);
    }
  }

  async function loadMessages(currentProvider) {
    try {
      // Всегда используем публичный RPC для чтения - это работает стабильнее всего
      const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const rawMessages = await contract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse();
      setMessagesList(items);
    } catch (error) { console.error(error); }
  }

  async function handlePublish() {
    if (!userAddress) {
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      addLog("Sending...");

      const ethProvider = getEthProvider();
      const provider = new ethers.BrowserProvider(ethProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      
      // 1. Отправляем транзакцию
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 300000 
      });
      
      addLog("Tx Hash: " + tx.hash.slice(0,10));
      setText("");
      
      // Оптимистичное обновление (сразу показываем "Pending")
      setMessagesList([{from: userAddress, text: text, time: "Pending... (Indexing)"}, ...messagesList]);
      
      // 2. ЖДЕМ ПОДТВЕРЖДЕНИЯ (С ЗАЩИТОЙ ОТ ОШИБКИ)
      try {
          addLog("Waiting for confirmation...");
          await tx.wait(); 
          addLog("Confirmed!");
      } catch (waitError) {
          // 👇 ВОТ ЗДЕСЬ МЫ ЛОВИМ ТУ ОШИБКУ СО СКРИНШОТА
          addLog("Receipt error skipped. Waiting manually...");
          // Просто ждем 4 секунды "вслепую", пока блокчейн обновится
          await new Promise(res => setTimeout(res, 4000));
      }

      // 3. Обновляем список
      setIsSending(false);
      await loadMessages(null); 
      addLog("List updated!");

    } catch (err) {
      setIsSending(false);
      addLog("ERROR: " + (err.shortMessage || err.message));
      alert("Error: " + err.message);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "100px" }}>
      <h2 style={{textAlign: "center"}}>Base Board</h2>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{padding: "12px 24px", background: "#0052FF", color: "white", border: "none", borderRadius: "10px", fontSize: "16px"}}
          >
             Connect Wallet
          </button>
        ) : (
          <div>
             <div style={{color: "green", fontWeight: "bold"}}>Connected: {userAddress.slice(0,6)}...</div>
             <div style={{fontSize: "12px"}}>Balance: {balance} ETH</div>
          </div>
        )}
      </div>

      <div style={{marginBottom: "20px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write message..."
            rows={3}
            style={{width: "100%", padding: 10, marginBottom: 10}}
        />
        <button 
            onClick={handlePublish} 
            disabled={isSending || !text}
            style={{width: "100%", padding: "12px", background: isSending ? "#999" : "#333", color: "white", border: "none"}}
        >
            {isSending ? "Posting..." : "Publish"}
        </button>
      </div>

      <div>
        {messagesList.map((m, i) => (
            <div key={i} style={{borderBottom: "1px solid #eee", padding: "10px 0"}}>
                <div style={{fontSize: "16px"}}>{m.text}</div>
                <small style={{color: "#888"}}>{m.from.slice(0,6)}... | {m.time}</small>
            </div>
        ))}
      </div>

       {/* Окно логов (можете удалить, когда убедитесь, что все работает) */}
      <div style={{
          marginTop: "20px", background: "#f0f0f0", padding: "10px", 
          fontSize: "10px", fontFamily: "monospace", height: "100px", overflowY: "scroll"
      }}>
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
}
