import sdk from "@farcaster/frame-sdk";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";
const BASE_CHAIN_ID_HEX = "0x2105"; // 8453
const BASE_CHAIN_ID_DECIMAL = 8453;

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
    loadMessages();
  }, []);

  // Вспомогательная функция для смены сети
  const checkNetwork = async (provider) => {
    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BASE_CHAIN_ID_DECIMAL) {
        addLog("Switching network...");
        await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID_HEX }]);
      }
    } catch (error) {
      if (error.code === 4902 || error.error?.code === 4902) {
         await provider.send("wallet_addEthereumChain", [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base Mainnet',
            rpcUrls: ['https://mainnet.base.org'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
         }]);
      }
    }
  };

  // --- ФУНКЦИЯ ПОДКЛЮЧЕНИЯ (С ОБХОДОМ БАГА ETHERS V6) ---
  async function connectWallet() {
    addLog("Connect clicked...");
    
    try {
      let accounts;
      let provider;

      // 1. ПРОВЕРКА: Если это Farcaster (Warpcast)
      // Тут оставляем твой старый метод, так как он работает
      if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
         addLog("Mode: Farcaster");
         provider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
         accounts = await provider.send("eth_requestAccounts", []);
      } 
      
      // 2. ПРОВЕРКА: Если это Браузер (Chrome/MetaMask)
      else if (typeof window !== "undefined" && window.ethereum) {
         addLog("Mode: Browser Direct");
         
         // !!! ГЛАВНОЕ ИСПРАВЛЕНИЕ !!!
         // Мы НЕ используем ethers для вызова окна (именно тут была ошибка -32603)
         // Мы вызываем нативный метод браузера. Он не может упасть с ошибкой библиотеки.
         accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
         
         // И только ПОСЛЕ того, как юзер нажал "Подключить", мы создаем провайдер
         provider = new ethers.BrowserProvider(window.ethereum);
      } 
      
      else {
         alert("Кошелек не найден!");
         return;
      }

      if (!accounts || !accounts[0]) return;

      // Дальше всё стандартно
      await checkNetwork(provider);

      setUserAddress(accounts[0]);
      
      const bal = await provider.getBalance(accounts[0]);
      setBalance(ethers.formatEther(bal));
      
      addLog("Connected: " + accounts[0].slice(0,6));
      loadMessages();

    } catch (error) {
      addLog("Error: " + error.message);
      console.error("Connect Error:", error);
      
      if (error.code === -32002) {
         alert("Запрос уже висит! Откройте расширение MetaMask.");
      } else {
         alert("Ошибка подключения: " + error.message);
      }
    }
  }

  // --- Загрузка сообщений ---
  async function loadMessages() {
    try {
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

  // --- Публикация ---
  async function handlePublish() {
    if (!userAddress) {
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      
      // Определяем провайдер заново для отправки
      let provider;
      if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
         provider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
      } else {
         provider = new ethers.BrowserProvider(window.ethereum);
      }

      await checkNetwork(provider);
      
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 500000 
      });
      
      setText("");
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);
      
      addLog("Sent! Waiting...");
      await new Promise(r => setTimeout(r, 5000));
      
      setIsSending(false);
      await loadMessages();

    } catch (err) {
      setIsSending(false);
      addLog("Error: " + err.message);
      alert("Error sending: " + err.message);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "100px" }}>
      <h2 style={{textAlign: "center"}}>Base Board</h2>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{padding: "12px 24px", background: "#0052FF", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", cursor: "pointer"}}
          >
              Connect Wallet
          </button>
        ) : (
          <div>
             <div style={{color: "green", fontWeight: "bold"}}>Connected: {userAddress.slice(0,6)}...</div>
             <div style={{fontSize: "12px"}}>Balance: {parseFloat(balance).toFixed(4)} ETH</div>
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
            style={{width: "100%", padding: "12px", background: isSending ? "#999" : "#333", color: "white", border: "none", cursor: isSending ? "default" : "pointer"}}
        >
            {isSending ? "Publishing..." : "Publish"}
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
      
      <div style={{marginTop: 20, fontSize: 10, color: "#999", fontFamily: "monospace"}}>
        {logs[0]}
      </div>
    </div>
  );
}
