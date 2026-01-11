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

  // Логирование для отладки прямо на экране
  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    console.log(`[Board Log] ${msg}`);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        if (sdk && sdk.actions) {
          await sdk.actions.ready();
          addLog("Farcaster SDK Ready");
        }
      } catch (e) { 
        console.error(e); 
      }
    };
    init();
    loadMessages();
  }, [addLog]);

  // --- УНИВЕРСАЛЬНАЯ функция получения "транспорта" (канала связи) ---
  const getTransport = () => {
    // 1. Приоритет: Farcaster
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return { type: 'farcaster', provider: sdk.wallet.ethProvider };
    }
    // 2. Обычный браузер (MetaMask и др.)
    if (typeof window !== "undefined" && window.ethereum) {
      return { type: 'window', provider: window.ethereum };
    }
    return null;
  };

  // --- Функция создания Ethers провайдера ---
  const createEthersProvider = () => {
    const transport = getTransport();
    if (!transport) return null;
    return new ethers.BrowserProvider(transport.provider);
  };

  // --- Смена сети ---
  const checkNetwork = async (provider) => {
    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BASE_CHAIN_ID_DECIMAL) {
        addLog(`Switching from ${network.chainId} to Base...`);
        try {
            await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID_HEX }]);
        } catch (switchError) {
            // Если сети нет, добавляем
            if (switchError.code === 4902 || switchError.error?.code === 4902) {
                await provider.send("wallet_addEthereumChain", [{
                    chainId: BASE_CHAIN_ID_HEX,
                    chainName: 'Base Mainnet',
                    rpcUrls: ['https://mainnet.base.org'],
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    blockExplorerUrls: ['https://basescan.org'],
                }]);
            } else {
                throw switchError;
            }
        }
      }
    } catch (error) {
      console.error("Network check error:", error);
      // Не прерываем выполнение, некоторые кошельки могут не поддерживать switch программно
    }
  };

  // --- ПОДКЛЮЧЕНИЕ ---
  async function connectWallet() {
    addLog("Connect button clicked"); // Проверка реакции кнопки
    
    const transport = getTransport();
    if (!transport) {
      alert("Wallet not found! Please install MetaMask or use Warpcast.");
      return;
    }

    try {
      // ИСПРАВЛЕНИЕ -32603 для браузера
      // Если мы в браузере (не Farcaster), вызываем запрос прав НАПРЯМУЮ
      if (transport.type === 'window') {
         addLog("Requesting window.ethereum permissions...");
         await transport.provider.request({ method: "eth_requestAccounts" });
      } else {
         // Для Farcaster просто логируем
         addLog("Using Farcaster Provider");
      }

      // Теперь подключаем Ethers
      const provider = new ethers.BrowserProvider(transport.provider);
      
      // Запрашиваем аккаунты уже через Ethers (права даны выше)
      const accounts = await provider.listAccounts(); 
      // listAccounts безопаснее чем send("eth_requestAccounts") в v6 после ручного запроса
      
      if (accounts.length === 0) {
         // На всякий случай, если listAccounts пуст
         await provider.send("eth_requestAccounts", []);
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      await checkNetwork(provider);

      setUserAddress(address);
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));
      
      addLog("Connected: " + address.slice(0,6));
      loadMessages(); // Обновляем ленту после подключения

    } catch (error) {
      addLog("Connect Error: " + (error.message || error));
      console.error("Full Connect Error:", error);
      alert("Connect Error: " + (error.shortMessage || error.message));
    }
  }

  // --- ЗАГРУЗКА СООБЩЕНИЙ (Только чтение) ---
  async function loadMessages() {
    try {
      // Используем публичный RPC, чтобы работало даже без кошелька
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
      console.error(error);
    }
  }

  // --- ПУБЛИКАЦИЯ ---
  async function handlePublish() {
    addLog("Publish clicked");
    
    if (!userAddress) {
      addLog("Not connected, connecting first...");
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      
      const provider = createEthersProvider(); // Создаем провайдер "на лету"
      if (!provider) throw new Error("No provider found");

      await checkNetwork(provider);
      
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      addLog("Sending transaction...");
      
      // Отправка
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001")
      });
      
      setText("");
      setMessagesList([{from: userAddress, text: text, time: "Mining..."}, ...messagesList]);
      
      // ОЖИДАНИЕ (Fix зависания)
      addLog("Transaction sent! Waiting for confirmation...");
      const receipt = await tx.wait(); // Ждем майнинга
      
      addLog(`Confirmed in block ${receipt.blockNumber}`);
      
      await loadMessages(); // Обновляем ленту

    } catch (err) {
      console.error(err);
      addLog("Publish Error: " + (err.shortMessage || err.message));
      alert("Error: " + (err.shortMessage || err.message));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "100px" }}>
      <h2 style={{textAlign: "center"}}>Base Board</h2>
      
      {/* Кнопка подключения */}
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

      {/* Форма отправки */}
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

      {/* Список сообщений */}
      <div>
        {messagesList.map((m, i) => (
            <div key={i} style={{borderBottom: "1px solid #eee", padding: "10px 0"}}>
                <div style={{fontSize: "16px"}}>{m.text}</div>
                <small style={{color: "#888"}}>{m.from.slice(0,6)}... | {m.time}</small>
            </div>
        ))}
      </div>
      
      {/* Логи (чтобы видеть что происходит на телефоне) */}
      <div style={{marginTop: 20, fontSize: 10, color: "#999", fontFamily: "monospace", borderTop: "1px solid #ddd", paddingTop: 5}}>
        <div>Debug Logs:</div>
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
}
