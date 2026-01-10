import sdk from "@farcaster/frame-sdk";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";
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
    loadMessages();
  }, []);

  // --- 1. Чистый поиск провайдера (без ethers) ---
  const getRawProvider = () => {
    // Farcaster
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return sdk.wallet.ethProvider;
    }
    // Браузер (MetaMask)
    if (typeof window !== "undefined" && window.ethereum) {
      // Если есть selectedProvider (для обхода конфликтов)
      return window.ethereum.selectedProvider || window.ethereum;
    }
    return null;
  };

  // --- 2. Проверка сети (Manual Request) ---
  const ensureNetwork = async (rawProvider) => {
    try {
      // Запрашиваем chainId напрямую
      const chainIdHex = await rawProvider.request({ method: 'eth_chainId' });
      const chainId = BigInt(chainIdHex);

      if (chainId === BASE_CHAIN_ID) return;

      addLog("Switching network...");
      await rawProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      });
    } catch (error) {
      // Если сети нет, добавляем
      if (error.code === 4902 || error.data?.code === 4902) {
        await rawProvider.request({
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
  };

  // --- 3. ПОДКЛЮЧЕНИЕ (Самое важное изменение) ---
  async function connectWallet() {
    try {
      const rawProvider = getRawProvider();
      if (!rawProvider) {
        alert("Wallet not found.");
        return;
      }

      addLog("Requesting accounts (Raw Mode)...");

      // 👇 ЗДЕСЬ МЫ НЕ ИСПОЛЬЗУЕМ ETHERS! 
      // Мы делаем запрос напрямую, это обходит ошибку -32603
      const accounts = await rawProvider.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) return;
      const address = accounts[0];

      // Проверяем сеть (тоже в ручном режиме)
      await ensureNetwork(rawProvider);

      setUserAddress(address);
      addLog("Connected: " + address.slice(0, 6));

      // А вот теперь можно подключить Ethers для чтения баланса
      const ethersProvider = new ethers.BrowserProvider(rawProvider);
      const bal = await ethersProvider.getBalance(address);
      setBalance(ethers.formatEther(bal));

      loadMessages();

    } catch (error) {
      addLog("Connect Error: " + error.message);
      // alert("Connect Error: " + error.message); 
    }
  }

  // --- 4. Загрузка ---
  async function loadMessages() {
    try {
      // Всегда публичный RPC
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

      const rawProvider = getRawProvider();
      // Перед отправкой убеждаемся в сети
      await ensureNetwork(rawProvider);

      // Тут уже нужен Ethers Signer
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 300000 
      });
      
      addLog("Tx Sent: " + tx.hash.slice(0,8));
      setText("");
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);

      try {
        await tx.wait();
        addLog("Tx Confirmed!");
      } catch (e) {
        addLog("Wait skipped.");
      }

      await new Promise(r => setTimeout(r, 4000));
      setIsSending(false);
      await loadMessages();

    } catch (err) {
      setIsSending(false);
      addLog("Error: " + (err.shortMessage || err.message));
      alert("Error: " + err.message);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", paddingBottom: "100px" }}>
      <h2 style={{textAlign: "center"}}>Base Board (Raw Mode)</h2>
      
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
