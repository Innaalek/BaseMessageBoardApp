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

  // Логирование для отладки
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

  // --- 1. Умный выбор провайдера ---
  const getEthProvider = () => {
    // Если мы внутри Farcaster - берем его
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return sdk.wallet.ethProvider;
    }
    // Если мы в обычном браузере - берем MetaMask
    if (typeof window !== "undefined" && window.ethereum) {
      return window.ethereum;
    }
    return null;
  };

  // --- 2. Функция смены сети (ОБЯЗАТЕЛЬНА для Chrome/Brave) ---
  const switchNetwork = async (provider) => {
    try {
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== BASE_CHAIN_ID_DECIMAL) {
        addLog("Switching network to Base...");
        await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID_HEX }]);
      }
    } catch (switchError) {
      // Если сети нет, пытаемся добавить
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
          throw addError;
        }
      } else {
        console.error("Network switch error (ignorable inside Warpcast):", switchError);
      }
    }
  };

  // --- 3. Подключение кошелька ---
  async function connectWallet() {
    try {
      const ethProvider = getEthProvider();
      if (!ethProvider) {
        alert("Wallet not found. Please install MetaMask or use Warpcast.");
        return;
      }

      const provider = new ethers.BrowserProvider(ethProvider);
      
      // Запрашиваем аккаунты
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts[0]) return;

      // ПРОВЕРЯЕМ СЕТЬ (Важно для Chrome!)
      await switchNetwork(provider);

      setUserAddress(accounts[0]);
      
      const bal = await provider.getBalance(accounts[0]);
      setBalance(ethers.formatEther(bal));
      addLog("Connected: " + accounts[0].slice(0,6));
      
      loadMessages(provider);

    } catch (error) {
      addLog("Connect Error: " + error.message);
      alert("Connect Error: " + error.message);
    }
  }

  // --- 4. Загрузка сообщений ---
  async function loadMessages(currentProvider) {
    try {
      // Всегда читаем через публичный RPC (стабильнее)
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

  // --- 5. Отправка сообщения ---
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
      const signer = await provider.getSigner();

      // На всякий случай проверяем сеть еще раз
      await switchNetwork(provider);

      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Отправляем
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 300000 // Лимит газа (для надежности)
      });
      
      addLog("Tx Sent: " + tx.hash.slice(0,8));
      setText("");
      
      // Показываем "Pending" сразу
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);

      // --- УНИВЕРСАЛЬНОЕ ОЖИДАНИЕ ---
      // Мы пытаемся ждать честно. Если не выходит - ждем таймером.
      try {
        addLog("Waiting confirmation...");
        await tx.wait(); // Ждем подтверждения блока
        addLog("Tx Confirmed!");
      } catch (waitError) {
        addLog("Wait skipped (normal for some wallets).");
      }

      // Ждем еще 2 секунды для надежности (чтобы ноды синхронизировались)
      await new Promise(r => setTimeout(r, 2000));

      // ОБНОВЛЯЕМ СПИСОК
      setIsSending(false);
      await loadMessages(null);
      addLog("List updated.");

    } catch (err) {
      setIsSending(false);
      addLog("Error: " + (err.shortMessage || err.message));
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
      
      {/* Логи можно оставить пока, чтобы видеть что происходит в Chrome */}
      <div style={{marginTop: 20, fontSize: 10, color: "#999", fontFamily: "monospace"}}>
        {logs[0]}
      </div>
    </div>
  );
}
