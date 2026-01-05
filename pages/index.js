import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "message", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "MessagePosted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "getLatestMessage",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "user", "type": "address" },
          { "internalType": "string", "name": "text", "type": "string" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "internalType": "tuple",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_text", "type": "string" }],
    "name": "postMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export default function MessageBoard() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
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
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
  }

  async function sendMessage() {
    if (!account || !contract) return;

    const signer = await provider.getSigner();
    const contractWithSigner = contract.connect(signer);

    try {
      await contractWithSigner.postMessage("base forever");
      const msg = await contractWithSigner.getLatestMessage();
      setLatestMessage(msg[1]);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>
      <br /><br />
      <input
        placeholder="Write a message..."
        onChange={(e) => setLatestMessage(e.target.value)}
        style={{ padding: "10px", width: "300px" }}
      />
      <br /><br />
      <button onClick={sendMessage}>Publish</button>
      <br /><br />
      <h3>Latest message from contract:</h3>
      <p>{latestMessage}</p>
      <button onClick={sendMessage}>Send Test Message</button>
    </div>
  );
}
