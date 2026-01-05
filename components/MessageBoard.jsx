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
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [message, setMessage] = useState("");
  const [latestMessage, setLatestMessage] = useState("");
  const [messagesCount, setLatestMessageCount] = useState(0);

  useEffect(() => {
    if (window.ethereum) {
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
    }
  }, []);

  async function connectWallet() {
    try {
      const accs = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const cont = new ethers.Contract(contractAddress, abi, signer);
      setAccount(accs[0]);
      setContract(cont);
      await loadOnChainData(cont);
    } catch (err) {
      alert("Wallet connection failed");
    }
  }

  async function loadOnChainData(cont) {
    try {
      const count = await cont.getMessagesCount();
      setLatestMessageCount(Number(count));
      if (count > 0) {
        const latest = await cont.getLatestMessage();
        setLatestMessage(latest.text);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function publishMessage() {
    if (!contract || !account) {
      alert("Connect wallet first!");
      return;
    }
    try {
      const fee = ethers.parseEther("0.000005");
      const tx = await contract.postMessage(message, { value: fee });
      await tx.wait();
      setMessage("");
      await loadOnChainData(contract);
    } catch (err) {
      alert("Transaction failed");
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      <div style={{ marginTop: "15px" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
          style={{ width: "100%", padding: "10px", minHeight: "80px", borderRadius: "6px" }}
        />
        <button onClick={publishMessage} style={{ marginTop: "10px", width: "100%" }}>
          Publish
        </button>
      </div>

      <h3 style={{ marginTop: "20px" }}>Total messages on-chain: {messagesCount}</h3>
      <p><b>Latest:</b> {latestMessage || "No messages yet..."}</p>
    </div>
  );
}
