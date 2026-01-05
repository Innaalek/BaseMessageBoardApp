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
  const [contract, setContract] = useState(null);
  const [input, setInput] = useState("");
  const [list, setList] = useState([]);
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return;
      const p = new ethers.BrowserProvider(window.ethereum);
      const network = await p.getNetwork();

      if (network.chainId === 8453n) {
        const c = new ethers.Contract(contractAddress, abi, p);
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
        setList(arr);
        c.on("MessagePosted", (user, message, timestamp) => {
          setList(prev => [...prev, {
            from: user,
            text: message,
            time: new Date(Number(timestamp) * 1000).toLocaleString()
          }]);
        });
      }
      setProvider(p);
    };
    init();
  }, []);

  async function connectWallet() {
    if (!provider) return;
    const signer = await provider.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);
    setContract(c);
    setAccount(await signer.getAddress());
  }

  async function publishMessage() {
    if (!contract) {
      alert("Connect wallet first");
      return;
    }
    if (!input.trim()) return;
    try {
      const tx = await contract.postMessage(input);
      await tx.wait();
      setInput("");
    } catch (err) {
      console.error("Publish failed:", err);
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
            placeholder="Write message..."
            style={{ width: "100%", minHeight: 60, marginTop: 10 }}
          />
          <button onClick={publishMessage} style={{ width: "100%", marginTop: 10 }}>
            Publish
          </button>
        </>
      )}

      <h3>On-chain messages:</h3>
      {list.length === 0 && <p>No messages found</p>}
      {list.map((m, i) => (
        <div key={i} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
          <b>{m.from.slice(0,6)}...</b>: {m.text}
          <div style={{ fontSize: 12, opacity: 0.7 }}>{m.time}</div>
        </div>
      ))}
    </div>
  );
}
