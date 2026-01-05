import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string message, uint256 timestamp)",
  "function postMessage(string calldata _text) external",
  "function getMessagesCount() external view returns (uint256)",
  "function messages(uint256) external view returns (address user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState(null);

  // Авто-загрузка сообщений из контракта при старте
  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      // Читаем только если сеть = Base
      if (network.chainId === 8453n) {
        const contract = new ethers.Contract(contractAddress, abi, provider);
        await loadMessages(contract);

        // Слушаем event глобально через provider, чтобы новые появлялись без reload
        contract.on("MessagePosted", (user, message, timestamp) => {
          setMessages(prev => [
            ...prev,
            { from: user, text: message, time: new Date(Number(timestamp) * 1000).toLocaleString() }
          ]);
        });
      }
    };
    init();
  }, []);

  async function loadMessages(contract) {
    try {
      const count = await contract.getMessagesCount();
      const list = [];
      for (let i = 0; i < count; i++) {
        const m = await contract.messages(i);
        list.push({
          from: m.user,
          text: m.text,
          time: new Date(Number(m.timestamp) * 1000).toLocaleString()
        });
      }
      setMessages(list);
    } catch (err) {
      console.error("Load failed:", err);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Wallet not found!");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const s = await provider.getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
    } catch (err) {
      console.error("Connect failed:", err);
    }
  }

  async function publishMessage() {
    if (!window.ethereum) {
      alert("Wallet not found!");
      return;
    }
    if (!input.trim()) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      const tx = await contract.postMessage(input);
      await tx.wait();

      alert("Message posted!");
      setInput("");
    } catch (err) {
      console.error("TX failed:", err);
      alert("Transaction failed");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>Base Message Board</h2>

      {!account && <button onClick={connectWallet}>Connect Wallet</button>}
      {account && <p>Connected: {account}</p>}

      {account && (
        <>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Write a message..."
            style={{ width: "100%", minHeight: 60, marginTop: 10, padding: 10 }}
          />
          <button onClick={publishMessage} style={{ width: "100%", marginTop: 10 }}>
            Publish
          </button>
        </>
      )}

      <h3>On-chain messages:</h3>
      {messages.length === 0 && <p>No messages yet</p>}
      {messages.map((m, i) => (
        <div key={i} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
          <b>{m.from.slice(0, 6)}...</b>: {m.text}
          <div style={{ fontSize: 12, opacity: 0.7 }}>{m.time}</div>
        </div>
      ))}
    </div>
  );
}
