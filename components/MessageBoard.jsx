import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function postMessage(string calldata _text) external payable"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [text, setText] = useState("");
  const [messagesCount, setMessagesCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState("");

  useEffect(() => {
    if (window.ethereum) {
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
    }
  }, []);

  async function connectWallet() {
    try {
      const accs = await provider.send("eth_requestAccounts", []);
      const s = await provider.getSigner();
      const c = new ethers.Contract(contractAddress, abi, s);
      setSigner(s);
      setContract(c);
      setAccount(accs[0]);
      await loadMessages(c);
    } catch (err) {
      alert("Wallet connection failed");
    }
  }

  async function loadMessages(c) {
    try {
      const count = await c.getMessagesCount();
      setMessagesCount(Number(count));

      if (count > 0) {
        const latest = await c.getLatestMessage();
        setLatestMessage(latest.text);
      }
    } catch (err) {
      console.error("Read error:", err);
    }
  }

  async function publishMessage() {
    if (!contract || !account) {
      alert("Connect wallet first!");
      return;
    }
    try {
      const fee = ethers.parseEther("0.000005");
      const tx = await contract.postMessage(text, { value: fee });
      await tx.wait();
      setText("");
      await loadMessages(contract);
    } catch (err) {
      alert("Transaction failed");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message..."
      />

      <button onClick={publishMessage}>Publish</button>

      <h3>Total messages: {messagesCount}</h3>
      <p><b>Latest:</b> {latestMessage || "No messages yet..."}</p>
    </div>
  );
}
