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
  const [messagesList, setMessagesList] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState("Detecting...");

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
          setMode("Farcaster");
        } else {
          setMode("Browser");
        }
      } catch (e) { console.error(e); }
    };
    init();
    loadMessages();
  }, []);

  // --- ЧИСТОЕ ПОДКЛЮЧЕНИЕ (БЕЗ ETHERS В БРАУЗЕРЕ) ---
  async function connectWallet() {
    addLog("Connect v4 clicked...");
    
    try {
      let accounts = [];

      // 1. Сценарий: FARCASTER (Работает - не трогаем)
      if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
         addLog("Connecting via Farcaster SDK...");
         const provider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
         accounts = await provider.send("eth_requestAccounts", []);
      } 
      // 2. Сценарий: БРАУЗЕР (Chrome/MetaMask)
      else if (typeof window !== "undefined" && window.ethereum) {
         addLog("Connecting via Native Window.Ethereum...");
         
         // !!! АБСОЛЮТНО ЧИСТЫЙ JS. НИКАКОГО ETHERS.JS !!!
         // Если здесь упадет ошибка, то это проблема самого MetaMask, а не библиотеки.
         accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
         
         // Мы СПЕЦИАЛЬНО не создаем здесь provider, чтобы не злить Ethers.js
      } 
      else {
         alert("Кошелек не найден!");
         return;
      }

      if (!accounts || !accounts[0]) {
        addLog("No accounts returned");
        return;
      }

      // Просто сохраняем адрес. Сеть проверим потом.
      setUserAddress(accounts[0]);
      addLog("Connected: " + accounts[0].slice(0,6));
      
      // Обновляем сообщения
      loadMessages();

    } catch (error) {
      addLog("ERR: " + error.message);
      console.error("Connect Error:", error);
      
      // Обработка отказа пользователя
      if (error.code === 4001) {
         alert("Вы отменили подключение.");
      } else if (error.code === -32002) {
         alert("Запрос висит в MetaMask! Откройте лису.");
      } else {
         // Выводим "чистую" ошибку
         alert("Ошибка: " + error.message);
      }
    }
  }

  // --- Загрузка сообщений (Только чтение - безопасно) ---
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

  // --- Смена сети (Native JS) ---
  async function switchToBaseNative() {
      if (!window.ethereum) return;
      try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
        });
      } catch (switchError) {
        // Если сети нет - добавляем (код 4902)
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: BASE_CHAIN_ID_HEX,
                    chainName: 'Base Mainnet',
                    rpcUrls: ['https://mainnet.base.org'],
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    blockExplorerUrls: ['https://basescan.org'],
                }],
            });
        }
      }
  }

  // --- Публикация (ЗДЕСЬ ПОДКЛЮЧАЕМ ETHERS) ---
  async function handlePublish() {
    if (!userAddress) {
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      
      // 1. Создаем провайдер "на лету" только в момент отправки
      let provider;
      let signer;

      if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
         // Farcaster
         provider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
         // Проверка сети для Farcaster (через Ethers)
         const network = await provider.getNetwork();
         if (Number(network.chainId) !== BASE_CHAIN_ID_DECIMAL) {
             await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID_HEX }]);
         }
         signer = await provider.getSigner();
      } else {
         // Браузер
         // Сначала проверяем сеть "нативным" методом
         await switchToBaseNative();
         
         // Теперь безопасно создаем Ethers Provider
         provider = new ethers.BrowserProvider(window.ethereum);
         signer = await provider.getSigner();
      }

      const contract = new ethers.Contract(contractAddress, abi, signer);

      // 2. Отправка
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 500000 
      });
      
      setText("");
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);
      
      addLog("Sent! Waiting...");
      await tx.wait(); // Ждем блока
      
      setIsSending(false);
      await loadMessages();

    } catch (err) {
      setIsSending(false);
      addLog("Error: " + (err.message || err));
      alert("Error sending: " + (err.shortMessage || err.message));
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "100px" }}>
      <h2 style={{textAlign: "center"}}>Base Board v4.0 (Safe)</h2>
      <div style={{textAlign: "center", fontSize: "12px", color: "#666", marginBottom: "10px"}}>
        Mode: {mode}
      </div>
      
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
