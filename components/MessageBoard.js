import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string message, uint256 timestamp)",
  "function postMessage(string calldata _text) external",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function messages(uint256) external view returns (address user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [message, setMessage] = useState("");
  const [messagesList, setMessagesList] = useState([]);

  useEffect(() => {
    const p = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const c = new ethers.Contract(contractAddress, abi, p);
    setProvider(p);
    setContract(c);
    loadAllMessages(c);
    subscribeToEvents(c);
  }, []);

  async function loadAllMessages(c) {
    if (!c) return;
    const count = await c.getMessagesCount();
    let list = [];
    for (let i = 0; i < count; i++) {
      const m = await c.messages(i);
      list.push({
        from: m.user,
        text: m.text,
        time: new Date(Number(m.timestamp) * 1000).toLocaleString()
      });
    }
    setMessagesList(list);
    setMessagesList([...list].reverse());
  }

  function subscribeToEvents(c) {
    if (!c) return;
    c.on("MessagePosted", (from, text, timestamp) => {
      const newMsg = {
        from,
        text,
        time: new Date(Number(timestamp) * 1000).toLocaleString()
      };
      setMessagesList((prev) => [newMsg, ...prev]);
    });
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install MetaMask or Rabby first!");
      return;
    }
    const p = new ethers.BrowserProvider(window.ethereum);
    const signer = await p.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);
    setContract(c);
  }

  async function publishMessage() {
    if (!contract || !provider?.getSigner) {
      alert("Connect wallet first!");
      return;
    }
    const tx = await contract.postMessage(message);
    await tx.wait();
    setMessage("");
  }

  return (
    <div className="p-5 font-sans">
      <button onClick={connectWallet} className="border px-3 py-1 rounded">
        Connect Wallet
      </button>

      <div className="mt-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message..."
          className="w-full border p-2 rounded"
        />
        <button onClick={publishMessage} className="border mt-2 px-3 py-1 rounded">
          Publish
        </button>
      </div>

      <h3 className="mt-5 text-xl font-bold">Messages on-chain:</h3>
      <ul className="mt-3 space-y-2">
        {messagesList.map((m, i) => (
          <li key={i} className="border p-2 rounded">
            <strong>{m.from.slice(0, 6)}...</strong>  
            <div>{m.text}</div>
            <em className="text-sm opacity-70">{m.time}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
