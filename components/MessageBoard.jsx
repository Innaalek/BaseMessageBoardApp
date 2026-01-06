import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) external",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function messages(uint256 index) external view returns (tuple(address user, string text, uint256 timestamp))",
  "event MessagePosted(address indexed user, string message, uint256 timestamp)"
];

export default function MessageBoard() {
  const [messagesList, setMessagesList] = useState([]);
  const [text, setText] = useState("");
  const [latest, setLatest] = useState("");

  async function loadMessages() {
    if (!window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const count = await contract.getMessagesCount();
    const items = [];

    for (let i = 0; i < count; i++) {
      const msg = await contract.messages(i);
      items.push({
        user: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      });
    }

    setMessagesList(items);

    const last = await contract.getLatestMessage();
    setLatest(last.text);
  }

  async function handlePublish() {
  try {
    if (!window.ethereum) {
      alert("MetaMask не найден");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
      "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2",
      [
        "function postMessage(string calldata _text) external",
        "event MessagePosted(address indexed user, string message, uint256 timestamp)",
        "function getMessagesCount() external view returns (uint256)",
        "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))"
      ],
      signer
    );

    const tx = await contract.postMessage(messageText);
    console.log("TX sent:", tx.hash);

    await tx.wait();
    console.log("TX confirmed");

    loadLatest();
  } catch (err) {
    console.error(err);
    alert("Transaction failed: " + err.message);
  }
}
  useEffect(() => {
    loadMessages();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => window.ethereum.request({ method: "eth_requestAccounts" })}>
        Connect Wallet
      </button>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <button onClick={handlePublish}>Publish</button>

      <h2>On-chain messages:</h2>
      {messagesList.length === 0 && <p>No messages found</p>}

      {messagesList.map((m, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
          <p>{m.text}</p>
          <small>from {m.user.slice(0, 6)}... — {m.time}</small>
        </div>
      ))}

      {latest && (
        <div style={{ marginTop: 20 }}>
          <h3>Latest message:</h3>
          <p>{latest}</p>
        </div>
      )}
    </div>
  );
}
