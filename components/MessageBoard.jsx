import sdk from "@farcaster/frame-sdk";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";
// Используем BigInt для надежного сравнения (ethers v6 возвращает BigInt)
const BASE_CHAIN_ID = 8453n; 
const BASE_CHAIN_ID_HEX = "0x2105";

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

  // --- 1. Поиск провайдера ---
  const getEthProvider = () => {
    // Farcaster (Мобильный)
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return sdk.wallet.ethProvider;
    }
    // Браузер (MetaMask и др.)
    if (typeof window !== "undefined" && window.ethereum) {
      // Пытаемся обойти конфликты кошельков (EIP-6963)
      // Если есть selectedProvider (у некоторых версий ММ), берем его
      if (window.ethereum.selectedProvider) return window.ethereum.selectedProvider;
      // Иначе берем стандартный
      return window.ethereum;
    }
    return null;
  };

  // --- 2. Мягкая проверка сети ---
  const ensureNetwork = async (provider) => {
    try {
      const net = await provider.getNetwork();
      addLog("Current Chain ID: " + net.chainId);

      // Если мы УЖЕ на Base (8453), то просто выходим. Ничего не трогаем!
      // Это предотвращает ошибку -32603
      if (net.chainId === BASE_CHAIN_ID) {
        addLog("Network is already Base. Good.");
        return;
      }

      addLog("Switching to Base...");
      await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID_HEX }]);
      
    } catch (switchError) {
      // Ошибка 4902 = Сеть не найдена, нужно добавить
      if (switchError.code === 4902 || switchError.error?.code === 4902) {
        try {
          await provider.send("wallet_addEthereumChain", [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: "Base Mainnet",
            rpcUrls: ["https://mainnet.base.org"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: ["https://basescan.org"]
          }]);
        } catch (addError) {
          console.error(addError);
          alert("Could not add Base network.");
        }
      } else {
        // Другие ошибки игнорируем (вдруг пользователь отменил, но был на правильной сети)
        console.error("Switch error:", switchError);
      }
    }
  };

  // --- 3. Подключение ---
  async function connectWallet() {
    try {
      const ethProvider = getEthProvider();
      if (!ethProvider) {
        alert("Wallet not found.");
        return;
      }

      const provider = new ethers.BrowserProvider(ethProvider);
      
      // Сначала запрашиваем аккаунты (БЕЗ смены сети)
      addLog("Requesting accounts...");
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (!accounts[0]) return;
      
      // Только когда получили доступ, проверяем сеть
      await ensureNetwork(provider);

      setUserAddress(accounts[0]);
      
      // Баланс
      try {
        const bal = await provider.getBalance(accounts[0]);
        setBalance(ethers.formatEther(bal));
      } catch (e) { console.error("Balance error", e); }

      addLog("Connected: " + accounts[0].slice(0,6));
      loadMessages(provider);

    } catch (error) {
      addLog("Connect Error: " + error.message);
      // Если ошибка про "User rejected", не пугаем пользователя алертом
      if (!error.message.includes("rejected")) {
        alert("Connect Error: " + error.message);
      }
    }
  }

  // --- 4. Загрузка (через публичный RPC) ---
  async function loadMessages(currentProvider) {
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

  // --- 5. Публикация ---
  async function handlePublish() {
    if (!userAddress) {
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      addLog("Preparing tx...");

      const ethProvider = getEthProvider();
      const provider = new ethers.BrowserProvider(ethProvider);
      
      // Проверка сети перед отправкой (на всякий случай)
      await ensureNetwork(provider);

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Отправка (c Gas Limit)
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 300000 
      });
      
      addLog("Tx Sent: " + tx.hash.slice(0,8));
      setText("");
      
      // UI Update
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);

      // Ожидание
      try {
        await tx.wait();
        addLog("Tx Confirmed!");
      } catch (waitError) {
        addLog("Wait skipped, waiting manually...");
      }

      await new Promise(r => setTimeout(r, 4000));
      setIsSending(false);
      await loadMessages(null);
      addLog("List updated.");

    } catch (err) {
      setIsSending(false);
      addLog("Error: " + (err.shortMessage || err.message));
      alert("Error: " + (err.shortMessage || err.message));
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
