import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"string","name":"message","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"MessagePosted","type":"event"},{"inputs":[],"name":"getLatestMessage","outputs":[{"components":[{"internalType":"address","name":"user","type":"address"},{"internalType":"string","name":"text","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct BaseMessageBoard.Message","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getMessagesCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_text","type":"string"}],"name":"postMessage","outputs":[],"stateMutability":"payable","type":"function"}];

export default function MessageBoard() {
  const [account, setAccount] = useState(null);
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState(null);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not installed!");
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accs = await provider.send("eth_requestAccounts", []);
    setAccount(accs[0]);
  }

  async function publishMessage() {
    if (!window.ethereum || !account) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      await contract.postMessage(text, { value: ethers.parseEther("0.000005") });
      setText("");
      loadData();
    } catch (err) {
      alert("Transaction failed: " + err.message);
    }
  }

  async function loadData() {
    if (!window.ethereum) return;
    const provider = new ethers.JsonRpcProvider();
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const c = await contract.getMessagesCount();
    setCount(Number(c));

    const l = await contract.getLatestMessage().catch(()=>null);
    setLatest(l);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <button onClick={connectWallet}>Connect Wallet</button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message..."
      />

      <button onClick={publishMessage}>Publish</button>

      <h3>Total messages: {count}</h3>

      {latest && (
        <div>
          <b>Latest:</b> {latest.text} <br />
          <small>from {latest.user} at {Number(latest.timestamp)}</small>
        </div>
      )}
    </div>
  );
}
