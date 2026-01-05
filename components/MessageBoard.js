import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

// Правильный ABI ТОЛЬКО под твой контракт
const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function getMessagesCount() external view returns (uint256)",
  "event MessagePosted(address indexed user, string message, uint256 timestamp)"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [message, setMessage] = useState("");
  const [latestMessage, setLatestMessage] = useState("");
  const [messagesCount, setMessagesCount] = useState(0);

  useEffect(() => {
    if (window.ethereum) {
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
      const cont = new ethers.Contract(contractAddress, abi, prov);
      setContract(cont);
      loadOnChainData(cont);
    }
  }, []);

  async function connectWallet() {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const cont = new ethers.Contract(contractAddress, abi, signer);
      setContract(cont);
      setAccount(accounts[0]);
    } catch (err) {
      alert("Wallet connection failed");
    }
  }

  async function loadOnChainData(cont) {
    try {
      const count = await cont.getMessagesCount();
      setMessagesCount(Number(count));

      const latest = await cont.getLatestMessage();
      setLatestMessage(latest.text);
    } catch (err) {
      console.error("Load error:", err);
    }
  }

  async function publishMessage() {
    if (!contract || !account) {
      alert("Connect wallet first!");
      return;
    }

    try {
      const fee = ethers.parseEther("0.000005"); // как ты просила, маленькая комиссия
      const tx = await contract.postMessage(message, { value: fee });
      await tx.wait();
      setMessage("");
      loadOnChainData(contract);
    } catch (err) {
      console.error("Tx error:", err);
      alert("Transaction failed");
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <div style={{ marginTop: "10px" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message..."
          style={{ width: "100%", padding: "10px" }}
        />
        <button onClick={publishMessage} style={{ marginTop: "10px" }}>
          Publish
        </button>
      </div>

      <h3>Messages on-chain: {messagesCount}</h3>
      <div>
        <b>Latest:</b> {latestMessage || "No messages yet..."}
      </div>
    </div>
  );
}
