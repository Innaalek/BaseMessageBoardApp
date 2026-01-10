// 👇 ОЧЕНЬ ВАЖНО: Импорт должен быть именно таким (без { })
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
  const [messagesList, setMessagesList] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [logs, setLogs] = useState([]); // Логи для экрана

  // Функция для вывода логов на экран телефона
  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    console.log(msg);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        addLog("Запуск приложения...");
        if (sdk && sdk.actions) {
            await sdk.actions.ready();
            addLog("SDK Ready вызван успешно");
        } else {
            addLog("SDK не найден или sdk.actions отсутствует");
        }
      } catch (e) { 
        addLog("Ошибка init: " + e.message); 
      }
    };
    init();
    
    // Пробуем загрузить сообщения через публичный провайдер
    loadMessages(null);
  }, [addLog]);

  const getEthProvider = () => {
    // 1. Сначала SDK (для мобильного приложения)
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      addLog("Найден Farcaster Provider");
      return sdk.wallet.ethProvider;
    }
    // 2. Потом MetaMask (для компа)
    if (typeof window !== "undefined" && window.ethereum) {
      addLog("Найден Window Ethereum (MetaMask)");
      return window.ethereum;
    }
    return null;
  };

  async function connectWallet() {
    addLog("Нажата кнопка Connect...");
    try {
      const ethProvider = getEthProvider();
      
      if (!ethProvider) {
        addLog("ОШИБКА: Провайдер кошелька не найден!");
        alert("Кошелек не найден. Вы в Warpcast?");
        return;
      }

      const provider = new ethers.BrowserProvider(ethProvider);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts[0]) {
        setUserAddress(accounts[0]);
        addLog("Подключен аккаунт: " + accounts[0].slice(0,6));
        
        // После подключения обновляем список сообщений уже через кошелек
        loadMessages(provider);
      }
    } catch (error) {
      addLog("Ошибка подключения: " + (error.message || error));
      alert("Ошибка: " + error.message);
    }
  }

  async function loadMessages(currentProvider) {
    try {
      let provider = currentProvider;
      if (!provider) {
         // Публичный RPC для чтения, если кошелек не подключен
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
      addLog("Сообщения загружены: " + items.length);
    } catch (error) { 
        // Тихий лог, чтобы не спамить ошибками
        console.error(error); 
    }
  }

  async function handlePublish() {
    if (!userAddress) {
      addLog("Сначала нужно подключить кошелек");
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      addLog("Начинаем отправку...");

      const ethProvider = getEthProvider();
      if (!ethProvider) throw new Error("Провайдер потерян");

      const provider = new ethers.BrowserProvider(ethProvider);
      const signer = await provider.getSigner();
      
      addLog("Signer получен: " + await signer.getAddress());

      // Проверка сети перед отправкой
      const network = await provider.getNetwork();
      addLog("Сеть: " + network.chainId);
      
      if (Number(network.chainId) !== BASE_CHAIN_ID) {
         addLog("Неверная сеть, пробуем переключить...");
         try {
           await provider.send("wallet_switchEthereumChain", [{ chainId: "0x2105" }]); // 8453 hex
         } catch (e) {
           addLog("Ошибка смены сети (возможно, не критично): " + e.message);
         }
      }

      const contract = new ethers.Contract(contractAddress, abi, signer);
      
      addLog("Вызываем транзакцию...");
      // Убрали gasLimit, пусть кошелек сам считает
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001") 
      });
      
      addLog("Транзакция отправлена! Хеш: " + tx.hash.slice(0,10));
      setText("");
      
      // Сразу показываем в интерфейсе
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);
      
      await tx.wait();
      addLog("Транзакция подтверждена!");
      setIsSending(false);
      
      // Перезагрузка списка
      setTimeout(() => loadMessages(provider), 2000);

    } catch (err) {
      setIsSending(false);
      addLog("ОШИБКА ОТПРАВКИ: " + (err.shortMessage || err.message));
      alert("Ошибка отправки. См. логи внизу.");
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "150px" }}>
      <h2 style={{textAlign: "center"}}>Base Board (Debug Mode)</h2>
      
      {/* Кнопка подключения */}
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{padding: "12px 24px", background: "#0052FF", color: "white", border: "none", borderRadius: "8px", fontSize: "16px"}}
          >
             Connect Wallet
          </button>
        ) : (
          <div style={{color: "green", fontWeight: "bold"}}>Connected: {userAddress.slice(0,6)}...</div>
        )}
      </div>

      {/* Форма отправки */}
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
            style={{width: "100%", padding: "12px", background: isSending ? "#999" : "#333", color: "white", border: "none"}}
        >
            {isSending ? "Отправка..." : "Опубликовать (0.000001 ETH)"}
        </button>
      </div>

      {/* Список сообщений */}
      <div>
        {messagesList.map((m, i) => (
            <div key={i} style={{borderBottom: "1px solid #eee", padding: "10px 0"}}>
                <div>{m.text}</div>
                <small style={{color: "#888"}}>{m.from.slice(0,6)}... | {m.time}</small>
            </div>
        ))}
      </div>

      {/* 👇 ОКНО ЛОГОВ (Для отладки на телефоне) 👇 */}
      <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "150px", 
          background: "black", color: "#00FF00", overflowY: "scroll", 
          padding: "10px", fontSize: "12px", fontFamily: "monospace", opacity: 0.9
      }}>
        <div style={{fontWeight: "bold", borderBottom: "1px solid #333"}}>DEBUG LOGS:</div>
        {logs.map((log, i) => (
            <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
