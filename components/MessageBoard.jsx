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
  const [contract, setContract] = useState(null);
  const [input, setInput] = useState("");
  const [list, setList] = useState([]);
  const [account, setAccount] = useState("");

  useEffect(() => {
    if (contract) {
      // подписываемся на событие, чтобы сообщения появлялись без reload
      contract.on("MessagePosted", (user, message, timestamp) => {
        setList(prev => [
          ...prev,
          { user, message, time: new Date(Number(timestamp) * 1000).toLocaleString() }
        ]);
      });
    }
  }, [contract]);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install wallet!");
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);
    setContract(c);
    setAccount(await signer.getAddress());
    await loadAll(c);
  }

  async function loadAll(c) {
    const count = await c.getMessagesCount();
    const arr = [];
    for (let i = 0; i < count; i++) {
      const m = await c.messages(i);
      arr.push({
        user: m.user,
        message: m.text,
        time: new Date(Number(m.timestamp) * 1000).toLocaleString()
      });
    }
    setList(arr);
  }

  async function publishMessage() {
    if (!contract) {
      alert("Connect first");
      return;
    }
    try {
      const fee = ethers.parseEther("0.000005");
      const tx = await contract.postMessage(input, { value: fee });
      await tx.wait();
      setInput("");
    } catch (err) {
      console.error(err);
      alert("Failed");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>Base Message Board</h2>
      {!account && <button onClick={connectWallet}>Connect Wallet</button>}
      {account && <p>Connected: {account}</p>}

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Write message..."
        style={{ width: "100%", minHeight: 60, marginTop: 10 }}
      />

      <button onClick={publishMessage} style={{ width: "100%", marginTop: 10 }}>
        Publish
      </button>

      <h3>On-chain messages:</h3>

      {list.length === 0 && <p>No messages found</p>}

      {list.map((m, i) => (
        <div key={i} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
          <b>{m.user.slice(0,6)}...</b>: {m.message}
          <div style={{ fontSize: 12, color: "#555" }}>{m.time}</div>
        </div>
      ))}
    </div>
  );
}
