import { sdk } from "@farcaster/frame-sdk"; // 1. Импорт SDK
import { useState, useEffect } from "react";
import { ethers } from "ethers";

// Твой адрес контракта
const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

// ! ВАЖНО: ABI должно совпадать с тем, что реально есть в контракте
const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessages() external view returns (tuple(address user, string text, uint256 timestamp)[])",
  "event MessagePosted(address indexed user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [contractInstance, setContractInstance] = useState(null);
  const [provider, setProvider] = useState(null);
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);

  // 2. Сообщаем Farcaster, что фрейм готов
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  async function connectWallet() {
    // 3. ИЩЕМ КОШЕЛЕК: Сначала пробуем взять из SDK (Farcaster), если нет — ищем window.ethereum (MetaMask)
    const ethProvider = sdk.wallet.ethProvider || window.ethereum;

    if (!ethProvider) {
      alert("Кошелек не найден! Попробуй открыть через Warpcast или установи кошелек.");
      return;
    }

    try {
      const _provider = new ethers.BrowserProvider(ethProvider);
      const signer = await _provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      setProvider(_provider);
      setContractInstance(contract);

      await loadMessages(contract, _provider);
    } catch (error) {
      console.error("Connection error:", error);
      alert("Ошибка подключения: " + (error.message || error));
    }
  }

  async function loadMessages(contract, provider) {
    if (!contract && !provider) return;

    const readContract = contract || new ethers.Contract(contractAddress, abi, provider);

    try {
      const rawMessages = await readContract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse();

      setMessagesList(items);

    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }

  async function handlePublish() {
    try {
      if (!contractInstance) {
        alert("Connect wallet first!");
        return;
      }

      const fee = ethers.parseEther("0.000001"); 

      const tx = await contractInstance.postMessage(text, { value: fee });
      
      await tx.wait();

      setText("");
      await loadMessages(contractInstance, provider);
      alert("Message posted!");

    } catch (err) {
      console.error(err);
      alert("Transaction failed: " + (err.reason || err.message));
    }
  }

  useEffect(() => {
    // 4. АВТО-ЗАГРУЗКА: Тоже проверяем оба варианта провайдера
    const ethProvider = sdk.wallet.ethProvider || window.ethereum;

    if (ethProvider) {
        const _provider = new ethers.BrowserProvider(ethProvider);
        const readContract = new ethers.Contract(contractAddress, abi, _provider);
        loadMessages(readContract, _provider);
    }
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: "600px", margin: "0 auto" }}>
      <h1>Base Message Board</h1>
      
      {!contractInstance ? (
        <button onClick={connectWallet} style={{padding: "10px 20px", marginBottom: 20}}>
            Connect Wallet
        </button>
      ) : (
        <p>Wallet connected</p>
      )}

      <div style={{display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message on Base..."
            rows={4}
            style={{padding: 10}}
        />
        <button onClick={handlePublish} style={{padding: "10px", cursor: "pointer"}}>
            Publish (Fee: 0.000001 ETH)
        </button>
      </div>

      <h2>On-chain messages:</h2>

      {messagesList.length === 0 && <p>No messages found or loading...</p>}

      {messagesList.map((m, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px", borderRadius: "8px" }}>
          <p style={{fontWeight: "bold", fontSize: "1.1em"}}>{m.text}</p>
          <small style={{color: "#666"}}>
            From: {m.from.slice(0, 6)}...{m.from.slice(-4)} <br/>
            Time: {m.time}
          </small>
        </div>
      ))}
    </div>
  );
}
