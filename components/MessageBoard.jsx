import sdk from "@farcaster/frame-sdk"; // Важно: без { }
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
  const [balance, setBalance] = useState("0"); // 👈 Добавили баланс
  const [messagesList, setMessagesList] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [logs, setLogs] = useState([]); 

  // Логгер
  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    console.log(msg);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        addLog("🚀 App Starting...");
        // 1. Сразу говорим Warpcast, что мы готовы
        if (sdk && sdk.actions) {
            await sdk.actions.ready();
            addLog("✅ SDK Ready called");
        } else {
            addLog("⚠️ SDK not found (Browser?)");
        }
      } catch (e) { 
        addLog("❌ Init Error: " + e.message); 
      }
    };
    init();
    loadMessages(null);
  }, [addLog]);

  const getEthProvider = () => {
    // Приоритет SDK
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      addLog("🔹 Using Farcaster Provider");
      return sdk.wallet.ethProvider;
    }
    // Фолбэк на ММ
    if (typeof window !== "undefined" && window.ethereum) {
      addLog("🔸 Using MetaMask");
      return window.ethereum;
    }
    return null;
  };

  async function connectWallet() {
    addLog("Botton clicked. Searching provider...");
    try {
      const ethProvider = getEthProvider();
      
      if (!ethProvider) {
        addLog("❌ ERROR: No provider found.");
        alert("Кошелек не найден. Если вы с телефона - обновите Warpcast.");
        return;
      }

      const provider = new ethers.BrowserProvider(ethProvider);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts[0]) {
        setUserAddress(accounts[0]);
        addLog("✅ Connected: " + accounts[0].slice(0,6));
        
        // ПРОВЕРКА БАЛАНСА И СЕТИ
        const net = await provider.getNetwork();
        addLog("Network ChainID: " + net.chainId);

        // Проверяем баланс
        const bal = await provider.getBalance(accounts[0]);
        const balEth = ethers.formatEther(bal);
        setBalance(balEth);
        addLog(`💰 Balance: ${balEth} ETH`);

        if (parseFloat(balEth) === 0) {
            alert("Внимание! Ваш баланс в сети BASE равен 0. Проверьте, в какой сети ваши $18!");
        }

        loadMessages(provider);
      }
    } catch (error) {
      addLog("❌ Connect Error: " + error.message);
      alert("Error: " + error.message);
    }
  }

  async function loadMessages(currentProvider) {
    try {
      let provider = currentProvider;
      if (!provider) {
         provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
      }
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
      addLog("Preparing transaction...");

      const ethProvider = getEthProvider();
      const provider = new ethers.BrowserProvider(ethProvider);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(contractAddress, abi, signer);
      
      // ВОТ ЭТО ИСПРАВЛЯЕТ ОШИБКУ НА НОУТБУКЕ
      // Мы добавляем gasLimit вручную
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 500000 
      });
      
      addLog("✅ Tx Sent! Hash: " + tx.hash.slice(0,10));
      setText("");
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);
      
      await tx.wait();
      addLog("✅ Tx Confirmed on Chain!");
      setIsSending(false);
      setTimeout(() => loadMessages(provider), 2000);

    } catch (err) {
      setIsSending(false);
      addLog("❌ SEND ERROR: " + (err.shortMessage || err.message));
      alert("Ошибка отправки. См. логи внизу.");
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "160px" }}>
      <h2 style={{textAlign: "center"}}>Base Board (V3 Fixed)</h2>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{padding: "14px 28px", background: "#0052FF", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "bold"}}
          >
             Connect Wallet
          </button>
        ) : (
          <div style={{textAlign: "center"}}>
            <div style={{color: "green", fontWeight: "bold"}}>Connected: {userAddress.slice(0,6)}...</div>
            <div style={{fontSize: "12px", color: "#666"}}>Balance: {balance} ETH</div>
          </div>
        )}
      </div>

      <div style={{marginBottom: "20px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write message..."
            rows={3}
            style={{width: "100%", padding: 10, marginBottom: 10, boxSizing: "border-box"}}
        />
        <button 
            onClick={handlePublish} 
            disabled={isSending || !text}
            style={{width: "100%", padding: "12px", background: isSending ? "#999" : "#333", color: "white", border: "none", borderRadius: "5px"}}
        >
            {isSending ? "Sending..." : "Publish (0.000001 ETH)"}
        </button>
      </div>

      <div>
        {messagesList.map((m, i) => (
            <div key={i} style={{borderBottom: "1px solid #eee", padding: "10px 0"}}>
                <div>{m.text}</div>
                <small style={{color: "#888"}}>{m.from.slice(0,6)}... | {m.time}</small>
            </div>
        ))}
      </div>

      {/* ОКНО ЛОГОВ - Покажет, что происходит на телефоне */}
      <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "150px", 
          background: "black", color: "#00FF00", overflowY: "scroll", 
          padding: "10px", fontSize: "11px", fontFamily: "monospace", opacity: 0.95, zIndex: 9999
      }}>
        <div style={{borderBottom: "1px solid #333", paddingBottom: "5px"}}>DEBUG LOGS:</div>
        {logs.map((log, i) => (
            <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
