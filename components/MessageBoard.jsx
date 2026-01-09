import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) external",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function messages(uint256 index) external view returns (address user, string text, uint256 timestamp)",
  "event MessagePosted(address indexed user, string message, uint256 timestamp)"
];

export default function MessageBoard() {
  const [contractInstance, setContractInstance] = useState(null);
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [latest, setLatest] = useState("");

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install wallet!");
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    setContractInstance(contract);
    loadMessages(contract);
  }

  async function loadMessages(contract) {
    if (!contract) return;

    const count = await contract.getMessagesCount();
    const items = [];

    for (let i = 0; i < count; i++) {
      const [user, msgText, timestamp] = await contract.messages(i);
      items.push({
        from: user,
        text: msgText,
        time: new Date(Number(timestamp) * 1000).toLocaleString()
      });
    }

    setMessagesList(items);

    const last = await contract.getLatestMessage();
    setLatest(last.text);
  }

  async function handlePublish() {
    try {
      if (!contractInstance) {
        alert("Connect wallet first!");
        return;
      }

      const tx = await contractInstance.postMessage(text);
      await tx.wait();

      setText("");
      loadMessages(contractInstance);

    } catch (err) {
      alert("Transaction failed: " + err.message);
    }
  }

  useEffect(() => {
    if (contractInstance) {
      connectWallet();
    }
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message..."
        style={{ width: "100%", padding: 10, marginTop: 10 }}
      />

      <button onClick={handlePublish} style={{ marginTop: 10 }}>
        Publish
      </button>

      <h2>On-chain messages:</h2>
      {messagesList.length === 0 && <p>No messages found</p>}

      {messagesList.map((m, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
          <p>{m.text}</p>
          <small>from {m.from.slice(0, 6)}... — {m.time}</small>
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
