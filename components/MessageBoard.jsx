import sdk from "@farcaster/frame-sdk";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

// ABI стандартный
const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessages() external view returns (tuple(address user, string text, uint256 timestamp)[])"
];

export default function MessageBoard() {
  const [userAddress, setUserAddress] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    // Инициализация SDK для Farcaster
    const init = async () => {
      try {
        if (sdk && sdk.actions) {
          await sdk.actions.ready();
        }
      } catch (e) {
        console.error("SDK Init Error:", e);
      }
    };
    init();
    loadMessages();
  }, []);

  // 1. Простая функция получения провайдера (как было в начале)
  const getProvider = () => {
    // Для Farcaster (Warpcast)
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return new ethers.BrowserProvider(sdk.wallet.ethProvider);
    }
    // Для Браузера (MetaMask)
    if (typeof window !== "undefined" && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  };

  // 2. Подключение кошелька
  async function connectWallet() {
    try {
      const provider = getProvider();
      
      if (!provider) {
        alert("Кошелек не найден. Откройте в Warpcast или установите MetaMask.");
        return;
      }

      // Запрашиваем аккаунты
      // Используем send, так как это самый базовый метод Ethers
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts && accounts.length > 0) {
        setUserAddress(accounts[0]);
        // Загружаем сообщения сразу после подключения
        loadMessages();
      }
      
    } catch (error) {
      console.error(error);
      // Выводим ошибку текстом, чтобы не было [object Object]
      alert("Ошибка подключения: " + (error.message || "Unknown error"));
    }
  }

  // 3. Загрузка сообщений (через публичную ноду, чтобы не зависеть от кошелька)
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
    } catch (error) {
      console.error("Load messages error:", error);
    }
  }

  // 4. Отправка сообщения (с исправлением зависания)
  async function handlePublish() {
    if (!userAddress) {
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      const provider = getProvider();
      const signer = await provider.getSigner();
      
      // Проверка сети (Base)
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 8453) {
        try {
            await provider.send("wallet_switchEthereumChain", [{ chainId: "0x2105" }]);
        } catch (e) {
            // Игнорируем ошибку смены сети, если кошелек сам предложит сменить при транзакции
            console.warn(e);
        }
      }

      const contract = new ethers.Contract(contractAddress, abi, signer);

      // А. Отправляем транзакцию
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001") 
      });
      
      setText("");
      // Временно показываем в списке (оптимистичный UI)
      setMessagesList([{from: userAddress, text: text, time: "Обработка..."}, ...messagesList]);
      
      // Б. !!! ГЛАВНОЕ ИСПРАВЛЕНИЕ: Ждем подтверждения !!!
      // Это заставит код ждать, пока блокчейн реально запишет данные
      await tx.wait(); 
      
      // В. Теперь обновляем список по-настоящему
      await loadMessages();

    } catch (err) {
      console.error(err);
      alert("Ошибка отправки: " + (err.shortMessage || err.message));
    } finally {
      setIsSending(false);
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
          <div style={{color: "green", fontWeight: "bold"}}>Connected: {userAddress.slice(0,6)}...</div>
        )}
      </div>

      <div style={{marginBottom: "20px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напишите сообщение..."
            rows={3}
            style={{width: "100%", padding: 10, marginBottom: 10}}
        />
        <button 
            onClick={handlePublish} 
            disabled={isSending || !text}
            style={{width: "100%", padding: "12px", background: isSending ? "#999" : "#333", color: "white", border: "none", cursor: isSending ? "default" : "pointer"}}
        >
            {isSending ? "Публикация..." : "Отправить"}
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
    </div>
  );
}
