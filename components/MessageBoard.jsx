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
  const [userAddress, setUserAddress] = useState("");
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 1. Инициализация SDK Farcaster
  useEffect(() => {
    const init = async () => {
      try {
        if (sdk && sdk.actions) {
          await sdk.actions.ready();
        }
      } catch (e) {
        console.error("SDK Init error:", e);
      }
    };
    init();
  }, []);

  // 2. Функция получения правильного провайдера
  const getEthProvider = () => {
    // В Warpcast mobile (iOS/Android) кошелек инжектится именно в window.ethereum
    if (typeof window !== "undefined" && window.ethereum) {
      return window.ethereum;
    }
    // Запасной вариант для специфичных клиентов Farcaster
    if (sdk?.wallet?.ethProvider) {
      return sdk.wallet.ethProvider;
    }
    return null;
  };

  async function connectWallet() {
    const ethProvider = getEthProvider();

    if (!ethProvider) {
      alert("Wallet not found. Please open in a wallet browser or Warpcast.");
      return;
    }

    try {
      const _provider = new ethers.BrowserProvider(ethProvider);
      
      // Запрашиваем аккаунты
      await _provider.send("eth_requestAccounts", []);
      const signer = await _provider.getSigner();
      const address = await signer.getAddress();
      
      setUserAddress(address);

      // Создаем контракт с подписчиком (Signer) для записи
      const contract = new ethers.Contract(contractAddress, abi, signer);
      setContractInstance(contract);

      // Сразу грузим сообщения
      loadMessages(_provider);
      
    } catch (error) {
      console.error("Connection error:", error);
      alert("Connection failed: " + (error.message || error));
    }
  }

  // Загрузка сообщений (Read-only)
  async function loadMessages(currentProvider) {
    try {
      // Если провайдер не передан, пробуем найти доступный
      let providerToUse = currentProvider;
      if (!providerToUse) {
          const ethP = getEthProvider();
          if (ethP) providerToUse = new ethers.BrowserProvider(ethP);
      }

      if (!providerToUse) return;

      const readContract = new ethers.Contract(contractAddress, abi, providerToUse);
      const rawMessages = await readContract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse();

      setMessagesList(items);
      setIsLoaded(true);

    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }

  async function handlePublish() {
    if (!contractInstance) {
      alert("Please connect wallet first!");
      return;
    }

    if (!text.trim()) return;

    try {
      setIsSending(true);
      const fee = ethers.parseEther("0.000001"); 
      
      // Отправка транзакции
      const tx = await contractInstance.postMessage(text, { value: fee });
      
      // Ждем подтверждения блока
      await tx.wait();

      setText("");
      alert("Message posted successfully!");

      // ВАЖНО: Делаем паузу 2 секунды, чтобы RPC успел обновиться, потом перезагружаем список
      setTimeout(async () => {
         const ethProvider = getEthProvider();
         const provider = new ethers.BrowserProvider(ethProvider);
         await loadMessages(provider);
         setIsSending(false);
      }, 2000);

    } catch (err) {
      setIsSending(false);
      console.error(err);
      // Выводим точную ошибку, чтобы понять в чем дело
      alert("Transaction failed: " + (err.shortMessage || err.message || "Unknown error"));
    }
  }

  // Автозагрузка при старте (Read only)
  useEffect(() => {
    const timer = setTimeout(() => {
         loadMessages(null);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{textAlign: "center"}}>Base Message Board</h1>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{
                padding: "12px 24px", 
                backgroundColor: "#0052FF", 
                color: "white", 
                border: "none", 
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "bold"
            }}>
             Connect Wallet
          </button>
        ) : (
          <div style={{padding: "10px", background: "#e6f2ff", borderRadius: "8px", display: "inline-block", color: "#0052FF"}}>
            <span style={{fontWeight: "bold"}}>Connected: </span> 
            {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
        )}
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message on Base..."
            rows={4}
            disabled={isSending}
            style={{
                padding: 12, 
                borderRadius: "8px", 
                border: "1px solid #ccc", 
                fontSize: "16px",
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "inherit"
            }}
        />
        <button 
            onClick={handlePublish} 
            disabled={!text.trim() || isSending}
            style={{
                padding: "12px", 
                backgroundColor: (text.trim() && !isSending) ? "#333" : "#ccc", 
                color: "white", 
                border: "none", 
                borderRadius: "8px",
                cursor: (text.trim() && !isSending) ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "bold"
            }}>
            {isSending ? "Publishing..." : "Publish (Cost: 0.000001 ETH)"}
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
          <p style={{fontWeight: "500", fontSize: "1.1em", margin: "0 0 8px 0", wordWrap: "break-word"}}>{m.text}</p>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: "0.85em", color: "#666"}}>
            <span>From: <span style={{color: "#0052FF"}}>{m.from.slice(0, 6)}...{m.from.slice(-4)}</span></span>
            <span>{m.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
