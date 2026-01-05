import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string text, uint256 timestamp)",
  "function postMessage(string calldata _text) external payable",
  "function messages(uint256) view returns (address user, string text, uint256 timestamp)",
  "function getMessagesCount() external view returns (uint256)"
];

export default function MessageBoard() {
  const [contract, setContract] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install MetaMask or Rabby Wallet!");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    // Проверяем сеть Base
    if (network.chainId !== 8453n) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch {
        alert("Please switch to Base Mainnet in your wallet");
        return;
      }
    }

    const signer = await provider.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);
    setContract(c);
    loadMessages(c);
  }

  async function loadMessages(c) {
    if (!c) return;
    const count = await c.getMessagesCount();
    const arr = [];

    for (let i = 0; i < Number(count); i++) {
      const m = await c.messages(i);
      arr.push({
        from: m.user,
        text: m.text,
        time: new Date(Number(m.timestamp) * 1000).toLocaleString(),
      });
    }

    setMessages(arr);
  }

  async function sendMessage() {
    if (!contract) {
      alert("Connect wallet first");
      return;
    }
    if (!message.trim()) return;

    try {
      const tx = await contract.postMessage(message, {
        value: ethers.parseEther("0.000001"), // комиссия
      });
      await tx.wait();
      setMessage("");
      loadMessages(contract);
    } catch (err) {
      console.error(err);
      alert("Transaction failed");
    }
  }

  // Подписка на событие
  useEffect(() => {
    if (!contract) return;
    contract.on("MessagePosted", () => loadMessages(contract));
    return () => contract.removeAllListeners();
  }, [contract]);

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
        {messages.map((m, i) => (
          <li key={i}>
            <strong>{m.from.slice(0, 6)}...</strong>: {m.text} <em>({m.time})</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
