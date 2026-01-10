import { sdk } from "@farcaster/frame-sdk";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

// Твой адрес контракта
const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessages() external view returns (tuple(address user, string text, uint256 timestamp)[])",
  "event MessagePosted(address indexed user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [contractInstance, setContractInstance] = useState(null);
  const [provider, setProvider] = useState(null);
  const [userAddress, setUserAddress] = useState(""); // Добавил для наглядности
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Инициализация SDK
  useEffect(() => {
    const init = async () => {
      try {
        if (sdk && sdk.actions) {
          await sdk.actions.ready();
          console.log("Farcaster SDK Ready");
        }
      } catch (e) {
        console.error("SDK Init error:", e);
      }
    };
    init();
  }, []);

  // 2. Вспомогательная функция для поиска провайдера
  const getEthProvider = () => {
    // Сначала ищем стандартный window.ethereum (MetaMask, Trust, Coinbase Wallet, Warpcast WebView)
    if (typeof window !== "undefined" && window.ethereum) {
      console.log("Found window.ethereum");
      return window.ethereum;
    }
    
    // Если нет, пробуем достать из SDK (безопасная проверка через ?.)
    if (sdk?.wallet?.ethProvider) {
      console.log("Found sdk.wallet.ethProvider");
      return sdk.wallet.ethProvider;
    }

    return null;
  };

  async function connectWallet() {
    console.log("Connecting wallet...");
    const ethProvider = getEthProvider();

    if (!ethProvider) {
      alert("Кошелек не найден! Пожалуйста, установите MetaMask или откройте приложение через Warpcast.");
      return;
    }

    try {
      // Создаем BrowserProvider
      const _provider = new ethers.BrowserProvider(ethProvider);
      
      // Запрашиваем доступ к аккаунту
      const accounts = await _provider.send("eth_requestAccounts", []);
      const signer = await _provider.getSigner();
      
      const address = await signer.getAddress();
      console.log("Connected address:", address);
      setUserAddress(address);

      const contract = new ethers.Contract(contractAddress, abi, signer);

      setProvider(_provider);
      setContractInstance(contract);

      // Загружаем сообщения сразу после подключения
      await loadMessages(contract, _provider);
      
    } catch (error) {
      console.error("Connection error detailed:", error);
      alert("Ошибка подключения: " + (error.reason || error.message || error));
    }
  }

  // Функция загрузки сообщений (Read Only)
  async function loadMessages(contract, currentProvider) {
    try {
      // Если контракт уже подключен (с signer) - используем его
      // Если нет - создаем read-only инстанс через window.ethereum (если есть) или ждем подключения
      let readContract = contract;

      if (!readContract) {
        const ethProvider = getEthProvider();
        if (ethProvider) {
             const _readProvider = new ethers.BrowserProvider(ethProvider);
             readContract = new ethers.Contract(contractAddress, abi, _readProvider);
        } else {
            // Если совсем нет провайдера, выходим, пока юзер не нажмет connect
            return;
        }
      }

      const rawMessages = await readContract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse(); // Показываем новые сверху

      setMessagesList(items);
      setIsLoaded(true);

    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }

  async function handlePublish() {
    if (!contractInstance) {
      alert("Сначала подключи кошелек (Connect Wallet)!");
      connectWallet(); // Пробуем подключить автоматически
      return;
    }

    if (!text.trim()) return;

    try {
      const fee = ethers.parseEther("0.000001"); 
      const tx = await contractInstance.postMessage(text, { value: fee });
      
      alert("Транзакция отправлена! Ждем подтверждения...");
      await tx.wait();

      setText("");
      await loadMessages(contractInstance, provider);
      alert("Сообщение опубликовано!");

    } catch (err) {
      console.error(err);
      alert("Ошибка транзакции: " + (err.reason || err.message));
    }
  }

  // Авто-загрузка сообщений при старте (если провайдер доступен сразу)
  useEffect(() => {
    // Небольшая задержка, чтобы убедиться, что window.ethereum прогрузился
    const timer = setTimeout(() => {
         loadMessages(null, null);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{textAlign: "center"}}>Base Message Board</h1>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!contractInstance ? (
          <button 
            onClick={connectWallet} 
            style={{
                padding: "12px 24px", 
                backgroundColor: "#0052FF", 
                color: "white", 
                border: "none", 
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer"
            }}>
             Connect Wallet
          </button>
        ) : (
          <div style={{padding: "10px", background: "#f0f0f0", borderRadius: "8px", display: "inline-block"}}>
            <span style={{color: "green"}}>● Connected: </span> 
            {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
        )}
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напиши что-нибудь в блокчейн Base..."
            rows={4}
            style={{
                padding: 12, 
                borderRadius: "8px", 
                border: "1px solid #ccc", 
                fontSize: "16px",
                width: "100%",
                boxSizing: "border-box"
            }}
        />
        <button 
            onClick={handlePublish} 
            disabled={!text.trim()}
            style={{
                padding: "12px", 
                backgroundColor: text.trim() ? "#333" : "#ccc", 
                color: "white", 
                border: "none", 
                borderRadius: "8px",
                cursor: text.trim() ? "pointer" : "not-allowed",
                fontSize: "16px"
            }}>
            Publish (Cost: 0.000001 ETH)
        </button>
      </div>

      <h2 style={{borderBottom: "2px solid #eee", paddingBottom: "10px"}}>On-chain messages:</h2>

      {!isLoaded && messagesList.length === 0 && <p style={{textAlign: "center", color: "#888"}}>Loading messages...</p>}
      {isLoaded && messagesList.length === 0 && <p style={{textAlign: "center"}}>No messages yet.</p>}

      {messagesList.map((m, i) => (
        <div key={i} style={{ 
            border: "1px solid #eee", 
            padding: "15px", 
            marginBottom: "10px", 
            borderRadius: "12px",
            backgroundColor: "#fafafa",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <p style={{fontWeight: "500", fontSize: "1.1em", margin: "0 0 8px 0"}}>{m.text}</p>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: "0.85em", color: "#666"}}>
            <span>Author: <span style={{color: "#0052FF"}}>{m.from.slice(0, 6)}...{m.from.slice(-4)}</span></span>
            <span>{m.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
