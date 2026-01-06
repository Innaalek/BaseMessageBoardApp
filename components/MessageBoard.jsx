import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string message, uint256 timestamp)",
  "function postMessage(string calldata _text) external payable",
  "function getMessagesCount() external view returns (uint256)",
  "function messages(uint256) external view returns (address user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [input, setInput] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [account, setAccount] = useState("");

  useEffect(() => {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    setProvider(p);

    const c = new ethers.Contract(contractAddress, abi, p);
    loadMessages(c);

    c.on("MessagePosted", (user, message, timestamp) => {
      setMessagesList(prev => [...prev, {
        from: user,
        text: message,
        time: new Date(Number(timestamp) * 1000).toLocaleString()
      }]);
    });

    setContract(c);
  }, []);

  async function connectWallet() {
    if (!provider) return;
    const s = await provider.getSigner();
    setSigner(s);
    const addr = await s.getAddress();
    setAccount(addr);
    const c = new ethers.Contract(contractAddress, abi, s);
    setContract(c);
    await loadMessages(c);
  }

  async function loadMessages(c) {
    try {
      const count = await c.getMessagesCount();
      const arr = [];
      for (let i = 0; i < count; i++) {
        const m = await c.messages(i);
        arr.push({
          from: m.user,
          text: m.text,
          time: new Date(Number(m.timestamp) * 1000).toLocaleString()
        });
      }
      setMessagesList(arr);
    } catch (err) {
      console.error("Read error:", err);
    }
  }

  async function publishMessage() {
    if (!contract || !signer) {
      alert("Connect wallet first!");
      return;
    }
    try {
      const fee = ethers.parseEther("0.000005");
      const tx = await contract.postMessage(input, { value: fee });
      await tx.wait();
      setInput("");
    } catch (err) {
      console.error("TX error:", err);
      alert("Transaction failed");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      {!account && <button onClick={connectWallet}>Connect Wallet</button>}
      {account && <p>Connected: {account}</p>}

      <textarea
        value={input}
        onChange={e => {
          setInput(e.target.value);
        }}
        placeholder="Write a message..."
        style={{ width: "100%", minHeight: 60, marginTop: 10 }}
      />

      <button onClick={publishMessage} style={{ width: "100%", marginTop: 10 }}>
        Publish
      </button>

      <h3>On-chain messages:</h3>

      {messagesList.length === 0 && <p>No messages found</p>}

      {messagesList.map((m, i) => (
        <div key={i} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
          <b>{m.from.slice(0,6)}...</b>: {m.text}
          <div style={{ fontSize: 12, color: "#555" }}>{m.time}</div>
        </div>
      ))}
    </div>
  );
}
