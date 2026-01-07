import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function messages(uint256 index) external view returns (tuple(address user, string text, uint256 timestamp))",
  "event MessagePosted(address indexed user, string message, uint256 timestamp)"
];

export default function MessageBoard() {
  const [messagesList, setMessagesList] = useState([]);
  const [text, setText] = useState("");
  const [latest, setLatest] = useState("");
  const [userWallet, setUserWallet] = useState(null);
  const [contractInstance, setContractInstance] = useState(null);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("Wallet not found");
        return;
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserWallet(address);

      const contract = new ethers.Contract(contractAddress, abi, signer);
      setContractInstance(contract);

      alert("Wallet connected: " + address);
      loadMessages(contract);
    } catch (err) {
      console.error(err);
      alert("Wallet connect failed: " + err.message);
    }
  }

  async function loadMessages(contract) {
    try {
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
    } catch (err) {
      console.error("Read error:", err);
    }
  }

  async function handlePublish() {
    try {
      if (!contractInstance) {
        alert("Connect wallet first!");
        return;
      }
      const tx = await contractInstance.postMessage(text, { value: 0 });
      await tx.wait();
      setText("");
      loadMessages(contractInstance);
    } catch (err) {
      console.error(err);
      alert("Transaction failed: " + err.message);
    }
  }

  useEffect(() => {
    if (window.ethereum && contractInstance) {
      loadMessages(contractInstance);
    }
  }, [contractInstance]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <div style={{ marginTop: 20 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <button onClick={handlePublish} style={{ marginTop: 10 }}>Publish</button>

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
