import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string message, uint256 timestamp)",
  "function postMessage(string calldata _text) external",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))"
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [message, setMessage] = "";
  const [latestMessage, setLatestMessage] = useState("");

  useEffect(() => {
    if (window.ethereum) {
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
      const cont = new ethers.Contract(contractAddress, abi, prov);
      setContract(cont);
    }
  }, []);

  async function connectWallet() {
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
    await loadLatestMessage();
  }

  async function loadLatestMessage() {
    const msg = await contract.getLatestMessage();
    setLatestMessage(msg.text);
  }

  async function sendMessage() {
    const signer = await provider.getSigner();
    const contractWithSigner = contract.connect(signer);
    const tx = await contractWithSigner.postMessage(message);
    await tx.wait();
    setMessage("");
    await loadLatestMessage();
  }

  return (
    <div className="p-5">
      <button onClick={connectWallet} className="px-4 py-2 border rounded">
        Connect Wallet
      </button>

      <div className="mt-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message here..."
          className="w-full p-2 border rounded"
        />
        <button onClick={sendMessage} className="px-4 py-2 border rounded mt-2">
          Publish
        </button>
      </div>

      <h3 className="mt-5 text-lg font-bold">Latest message from contract:</h3>
      <p className="mt-2">{latestMessage || "No messages yet..."}</p>
    </div>
  );
}
