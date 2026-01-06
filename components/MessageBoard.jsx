import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";
const abi = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "message", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "MessagePosted",
    "type": "event"
  },
  {
    "inputs": [], "name": "getLatestMessage",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "getMessagesCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "messages",
    "outputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "string", "name": "text", "type": "string" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_text", "type": "string" }],
    "name": "postMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
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
    setLatest(last);
  }

  async function publish() {
    if (!window.ethereum || !text) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      await contract.postMessage(text);
      setText("");
      loadMessages();
    } catch (e) {
      alert("Transaction failed");
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  return (
    <div className="p-4">
      <button onClick={() => window.ethereum.request({ method: "eth_requestAccounts" })}>
        Connect Wallet
      </button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message..."
      />

      <button onClick={publish}>Publish</button>

      <h2>On-chain messages:</h2>
      {messagesList.length === 0 && <p>No messages found</p>}

      {messagesList.map((m, i) => (
        <div key={i} className="border p-2 my-2">
          <p>{m.text}</p>
          <small>from {m.user} — {m.time}</small>
        </div>
      ))}
    </div>
  );
}
