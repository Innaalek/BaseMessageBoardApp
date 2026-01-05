import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string message, uint256 timestamp)",
  "function postMessage(string calldata _text) external",
  "function messages(uint256) view returns (address user, string text, uint256 timestamp)",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [message, setMessage] = useState("");
  const [messagesList, setMessagesList] = useState([]);

  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);
      const c = new ethers.Contract(contractAddress, abi, p);
      setContract(c);
      loadMessages(c);
    }
  }, []);

  async function loadMessages(c) {
    if (!c) return;
    const count = await c.getMessagesCount();
    const list = [];

    for (let i = 0; i < count; i++) {
      const m = await c.messages(i);
      list.push({
        from: m.user,
        text: m.text,
        time: new Date(Number(m.timestamp) * 1000).toLocaleString(),
      });
    }

    setMessagesList(list.reverse());
  }

  async function connectWallet() {
    if (!provider) return;
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== 8453) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch {
        alert("Переключи сеть на Base Mainnet в кошельке!");
        return;
      }
    }

    const signer = await provider.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);
    setContract(c);
    loadMessages(c);
  }

  async function sendMessage() {
    if (!contract || !provider.getSigner) {
      alert("Сначала подключи кошелек!");
      return;
    }
    if (!message.trim()) return;

    const signer = await provider.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);

    try {
      const tx = await c.postMessage(message, {
        value: "0x1c6bf52634000", // маленькая комиссия (~0.000005 ETH)
      });
      await tx.wait();
      setMessage("");
      loadMessages(c);
    } catch (err) {
      console.error(err);
      alert("Ошибка отправки транзакции!");
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <div style={{ marginTop: "20px" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message..."
          style={{ width: "100%", padding: "10px" }}
        />
        <button onClick={sendMessage}>Publish</button>
      </div>

      <h3>Messages on-chain:</h3>
      <ul>
        {messagesList.map((m, i) => (
          <li key={i}>
            <strong>{m.from.slice(0, 6)}...</strong>: {m.text} <em>({m.time})</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
