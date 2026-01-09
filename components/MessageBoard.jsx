import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) payable external",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function messages(uint256 index) external view returns (tuple(address user, string text, uint256 timestamp))",
  "event MessagePosted(address indexed user, string message, uint256 timestamp)"
];

export default function MessageBoard() {
  const [contractInstance, setContractInstance] = useState(null);
  const [provider, setProvider] = useState(null);
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [latest, setLatest] = useState("");

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install wallet!");
      return;
    }

    const _provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await _provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    setProvider(_provider);
    setContractInstance(contract);

    await loadMessages(contract, _provider);
  }

  async function loadMessages(contract, provider) {
    if (!contract || !provider) return;

    const readContract = new ethers.Contract(contractAddress, abi, provider);
    const count = await readContract.getMessagesCount();
    const items = [];

    for (let i = 0; i < count; i++) {
      const msg = await readContract.messages(i);
      items.push({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      });
    }

    setMessagesList(items);

    const last = await readContract.getLatestMessage();
    setLatest(last.text);
  }

  async function handlePublish() {
    try {
      if (!contractInstance) {
        alert("Connect wallet first!");
        return;
      }

      const fee = ethers.parseEther("0.000005");

      const tx = await contractInstance.postMessage(text, { value: fee });
      await tx.wait();

      setText("");
      await loadMessages(contractInstance, provider);

    } catch (err) {
      alert("Transaction failed: " + err.message);
    }
  }

  useEffect(() => {
    if (contractInstance && provider) {
      loadMessages(contractInstance, provider);
    }
  }, [contractInstance, provider]);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message..."
      />

      <button onClick={handlePublish}>Publish</button>

      <h2>On-chain messages:</h2>

      {messagesList.length === 0 && <p>No messages found</p>}

      {messagesList.map((m, i) => (
        <div key={i}>
          <p>{m.text}</p>
          <small>{m.from.slice(0, 6)}... — {m.time}</small>
        </div>
      ))}

      {latest && <h3>Latest: {latest}</h3>}
    </div>
  );
}
