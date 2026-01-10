import sdk from "@farcaster/frame-sdk"; // 👈 Убедись, что скобок нет!
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";
const BASE_CHAIN_ID = "0x2105"; 
const BASE_CHAIN_ID_DECIMAL = 8453;

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
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Сообщаем Warpcast, что мы готовы
        if (sdk && sdk.actions) {
            await sdk.actions.ready();
        }
      } catch (e) { console.error(e); }
    };
    init();
    
    // Пытаемся загрузить сообщения сразу (даже без кошелька)
    // Для этого нужен публичный провайдер, но пока оставим как есть
    setTimeout(() => loadMessages(null), 1000);
  }, []);

  // --- ИСПРАВЛЕННАЯ ЛОГИКА ПОИСКА КОШЕЛЬКА ---
  const getEthProvider = () => {
    // 1. Приоритет: Farcaster Mobile / Warpcast
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return sdk.wallet.ethProvider;
    }
    // 2. Десктоп / Браузер
    if (typeof window !== "undefined" && window.ethereum) {
      return window.ethereum;
    }
    return null;
  };

  async function checkAndSwitchNetwork(provider) {
    try {
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(BASE_CHAIN_ID_DECIMAL)) {
        await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID }]);
      }
    } catch (error) {
      // Если сети Base нет в кошельке - добавляем (актуально для ММ, Warpcast сам знает Base)
      if (error.code === 4902 || error.error?.code === 4902) {
         try {
           await provider.send("wallet_addEthereumChain", [{
             chainId: BASE_CHAIN_ID,
             chainName: "Base Mainnet",
             rpcUrls: ["https://mainnet.base.org"],
             nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
             blockExplorerUrls: ["https://basescan.org"]
           }]);
         } catch (addError) { throw addError; }
      } else {
         console.error("Switch error:", error);
         // В Warpcast иногда ошибка переключения ложная, игнорируем
      }
    }
  }

  async function connectWallet() {
    try {
      const ethProvider = getEthProvider();
      
      // ОТЛАДКА: Если на телефоне выскочит этот Alert - значит SDK не работает
      if (!ethProvider) {
        alert("Ошибка: Кошелек не найден. Вы открыли это в Warpcast?");
        return;
      }

      const _provider = new ethers.BrowserProvider(ethProvider);
      
      // Запрос аккаунтов
      const accounts = await _provider.send("eth_requestAccounts", []);
      
      if (!accounts || accounts.length === 0) {
        alert("Доступ к аккаунту не получен");
        return;
      }

      // Проверка сети
      await checkAndSwitchNetwork(_provider);

      const signer = await _provider.getSigner();
      const address = await signer.getAddress();
      
      setUserAddress(address);
      
      const contract = new ethers.Contract(contractAddress, abi, signer);
      setContractInstance(contract);
      
      // Загружаем сообщения
      loadMessages(_provider);

    } catch (error) {
      console.error(error);
      alert("Ошибка подключения: " + (error.message || error));
    }
  }

  async function loadMessages(currentProvider) {
    try {
      let providerToUse = currentProvider;
      if (!providerToUse) {
         const ethP = getEthProvider();
         if (ethP) providerToUse = new ethers.BrowserProvider(ethP);
      }
      // Если совсем нет провайдера (не подключен), используем публичный RPC для чтения
      if (!providerToUse) {
         providerToUse = new ethers.JsonRpcProvider("https://mainnet.base.org");
      }

      const readContract = new ethers.Contract(contractAddress, abi, providerToUse);
      const rawMessages = await readContract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse();

      setMessagesList(items);
    } catch (error) { console.error("Load msg error:", error); }
  }

  async function handlePublish() {
    if (!contractInstance) {
      await connectWallet();
      return;
    }
    if (!text.trim()) return;

    try {
      setIsSending(true);
      
      // 1. Добавляем "временное" сообщение сразу (Optimistic UI)
      const optimisticMessage = {
        from: userAddress,
        text: text,
        time: "Sending..."
      };
      setMessagesList([optimisticMessage, ...messagesList]);
      const messageText = text; 
      setText(""); // Очищаем поле ввода сразу

      // 2. Отправляем транзакцию
      const fee = ethers.parseEther("0.000001"); 
      const tx = await contractInstance.postMessage(messageText, { 
        value: fee
      });
      
      // 3. Ждем подтверждения
      await tx.wait();
      
      alert("Sent!"); // Сообщение ушло в блокчейн
      setIsSending(false);
      
      // 4. Обновляем реальный список из блокчейна
      // Небольшая задержка, чтобы ноды успели обновиться
      setTimeout(() => {
          if (contractInstance.runner && contractInstance.runner.provider) {
             loadMessages(contractInstance.runner.provider);
          }
      }, 2000);

    } catch (err) {
      setIsSending(false);
      alert("Error sending: " + (err.shortMessage || err.message));
      // Если ошибка - можно вернуть текст обратно в поле, но это по желанию
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{textAlign: "center"}}>Base Board</h1>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{
                padding: "14px 28px", backgroundColor: "#0052FF", color: "white", 
                border: "none", borderRadius: "10px", fontSize: "18px", fontWeight: "bold", cursor: "pointer"
            }}>
             Connect Wallet
          </button>
        ) : (
          <div style={{padding: "10px", background: "#e6f2ff", borderRadius: "8px", display: "inline-block", color: "#0052FF"}}>
            ✅ {userAddress.slice(0, 4)}...{userAddress.slice(-4)}
          </div>
        )}
      </div>

      <div style={{marginBottom: "30px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write something..."
            rows={3}
            disabled={isSending}
            style={{
                padding: 12, borderRadius: "8px", border: "1px solid #ccc", 
                fontSize: "16px", width: "100%", boxSizing: "border-box", marginBottom: "10px"
            }}
        />
        <button 
            onClick={handlePublish} 
            disabled={!text.trim() || isSending}
            style={{
                width: "100%", padding: "12px", 
                backgroundColor: (text.trim() && !isSending) ? "#333" : "#ccc", 
                color: "white", border: "none", borderRadius: "8px",
                fontSize: "16px", fontWeight: "bold"
            }}>
            {isSending ? "Sending..." : "Publish"}
        </button>
      </div>

      <h3>Messages:</h3>
      {messagesList.map((m, i) => (
        <div key={i} style={{ 
            borderBottom: "1px solid #eee", padding: "10px 0"
        }}>
          <div style={{fontSize: "16px", marginBottom: "4px"}}>{m.text}</div>
          <div style={{fontSize: "12px", color: "#888"}}>
            From: {m.from.slice(0, 6)}... &bull; {m.time}
          </div>
        </div>
      ))}
    </div>
  );
}
