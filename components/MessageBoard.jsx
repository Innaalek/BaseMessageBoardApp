import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function getMessagesCount() external view returns (uint256)",
  "event MessagePosted(address indexed user, string message, uint256 timestamp)"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [message, setMessage] = useState("");
  const [latestMessage, setLatestMessage] = useState("");
  const [messagesCount, setMessagesCount] = useState(0);

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

      setAccount(accs[0]);
      setSigner(s);
      setContract(c);

      await loadData(c);
    } catch (err) {
      alert("Wallet connection failed");
    }
  }

  async function loadData(c) {
    try {
      const count = await c.getMessagesCount();
      setMessagesCount(Number(count));

      const latest = await c.getLatestMessage();
      setLatestMessage(latest.text);
    } catch (err) {
      console.error(err);
    }
  }

  async function publishMessage() {
    if (!contract || !account) return;

    try {
      const fee = ethers.parseEther("0.000005");
      const tx = await contract.postMessage(message, { value: fee });
      await tx.wait();

      setMessage("");
      await loadData(contract);
    } catch (err) {
      alert("Transaction failed");
    }
  }

  return (
    <div className="p-5 max-w-xl mx-auto">
      <button onClick={connectWallet}>Connect Wallet</button>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write a message..."
      />

      <button onClick={connectWallet}>Publish</button>

      <h3>Total on-chain messages: {messagesCount}</h3>
      <p><b>Latest:</b> {latestMessage || "No messages yet..."}</p>
    </div>
  );
}
