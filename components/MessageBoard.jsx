import sdk from "@farcaster/frame-sdk";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

// ABI сокращен до необходимого минимума
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
    // 1. Инициализация Farcaster SDK
    const initSdk = async () => {
      try {
        if (sdk && sdk.actions) {
          await sdk.actions.ready();
        }
      } catch (e) {
        console.error("SDK Error:", e);
      }
    };
    initSdk();
    
    // 2. Загрузка сообщений (через публичный RPC, чтобы работало у всех)
    loadMessages();
  }, []);

  // --- ЧТЕНИЕ (Всегда через публичную ноду) ---
  async function loadMessages() {
    try {
      // Используем публичный провайдер Base, чтобы не зависеть от глюков кошелька при чтении
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
      console.error("Load Error:", error);
    }
  }

  // --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Найти провайдер ---
  const getNativeProvider = () => {
    // Приоритет 1: Farcaster
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return sdk.wallet.ethProvider;
    }
    // Приоритет 2: Браузер (MetaMask)
    if (typeof window !== "undefined" && window.ethereum) {
      return window.ethereum;
    }
    return null;
  };

  // --- ПОДКЛЮЧЕНИЕ (БЕЗ ETHERS.JS) ---
  async function connectWallet() {
    const provider = getNativeProvider();
    
    if (!provider) {
      alert("Кошелек не найден. Установите MetaMask или откройте в Warpcast.");
      return;
    }

    try {
      // Прямой запрос к кошельку (минуя библиотеку Ethers, где была ошибка)
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      
      if (accounts && accounts.length > 0) {
        setUserAddress(accounts[0]);
      } else {
        alert("Вы не выбрали аккаунт.");
      }
    } catch (error) {
      console.error(error);
      alert("Ошибка подключения: " + error.message);
    }
  }

  // --- ОТПРАВКА (ТУТ ПОДКЛЮЧАЕМ ETHERS) ---
  async function handlePublish() {
    if (!text) return;

    // Если нет адреса, пробуем подключить
    if (!userAddress) {
      await connectWallet();
      // Если после попытки адреса всё ещё нет — выходим
      if (!userAddress) return;
    }

    setIsSending(true);

    try {
      const nativeProvider = getNativeProvider();
      if (!nativeProvider) throw new Error("No provider found");

      // 1. Создаем обертку Ethers ТОЛЬКО для отправки
      const provider = new ethers.BrowserProvider(nativeProvider);
      const signer = await provider.getSigner();

      // 2. Проверка сети (Base Chain ID: 8453)
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 8453) {
        try {
          await nativeProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }], // 8453 hex
          });
        } catch (switchError) {
          // Если сети нет, добавляем (упрощенно)
           if (switchError.code === 4902) {
             alert("Пожалуйста, добавьте сеть Base в кошелек вручную и повторите.");
             setIsSending(false);
             return;
           }
           throw switchError;
        }
        // Небольшая пауза чтобы кошелек успел переключиться
        await new Promise(r => setTimeout(r, 1000));
      }

      const contract = new ethers.Contract(contractAddress, abi, signer);

      // 3. Отправка транзакции
      const tx = await contract.postMessage(text, {
        value: ethers.parseEther("0.000001")
      });

      // UI: Показываем, что процесс идет
      setText("");
      setMessagesList([{ from: userAddress, text: text + " (Отправка...)", time: "Pending" }, ...messagesList]);

      // 4. ОЖИДАНИЕ (Fix зависания)
      const receipt = await tx.wait(); // Ждем завершения майнинга

      if (receipt.status === 1) {
        // Успех
        await loadMessages();
      } else {
        alert("Транзакция не прошла (reverted).");
      }

    } catch (error) {
      console.error(error);
      // Показываем реальную причину ошибки
      alert("Ошибка отправки: " + (error.reason || error.message || error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "100px" }}>
      <h2 style={{textAlign: "center"}}>Base Board V3</h2>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{
              padding: "12px 24px", 
              background: "#0052FF", 
              color: "white", 
              border: "none", 
              borderRadius: "10px", 
              fontSize: "16px", 
              cursor: "pointer"
            }}
          >
              Connect Wallet
          </button>
        ) : (
          <div style={{color: "green", fontWeight: "bold"}}>
            Connected: {userAddress.slice(0,6)}...{userAddress.slice(-4)}
          </div>
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
            style={{
              width: "100%", 
              padding: "12px", 
              background: isSending ? "#999" : "#333", 
              color: "white", 
              border: "none", 
              cursor: isSending ? "wait" : "pointer"
            }}
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
