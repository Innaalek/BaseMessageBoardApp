import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "function postMessage(string calldata _text) external",
  "function getMessagesCount() external view returns (uint256)",
  "function getLatestMessage() external view returns (tuple(address user, string text, uint256 timestamp))",
  "function messages(uint256 index) external view returns (address user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [contractInstance, setContractInstance] = useState(null);
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [userWallet, setUserWallet] = useState(null);

  async function connectWallet() {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserWallet(address);

      const contract = new ethers.Contract(contractAddress, abi, signer);
      setContractInstance(contract);

      await loadMessages(contract);
    } catch (err) {
      alert("Wallet connect failed: " + err.message);
    }
  }

  async function loadMessages(contract) {
    try {
      const count = await contract.getMessagesCount();
      const items = [];

      for (let i = 0; i < count; i++) {
        const msg = await contract.messages(i);
        items.push({
          user: msg[0],
          text: msg[1],
          time: new Date(Number(msg[2]) * 1000).toLocaleString()
        });
      }

      setMessagesList(items);
    } catch (err) {
      console.error("Read failed:", err);
    }
  }

 async function handlePublish() {
  try {
    if (!contractInstance) {
      alert("Connect wallet first!");
      return;
    }

    const POST_FEE = await contractInstance.POST_FEE(); // читаем fee из контракта

    const tx = await contractInstance.postMessage(text, {
      value: POST_FEE // ← передаём fee в ETH
    });

    await tx.wait();
    setText("");
    await loadMessages(contractInstance);

  } catch (err) {
    alert("Transaction failed: " + err.message);
  }
}

  useEffect(() => {
    if (contractInstance) {
      loadMessages(contractInstance);
    }
  }, [contractInstance]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <button onClick={connectWallet}>Connect Wallet</button>

      {userWallet && (
        <p style={{ marginTop: 10 }}>
          Connected: <strong>{userWallet}</strong>
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <button onClick={handlePublish} style={{ marginTop: 10 }}>
        Publish
      </button>

      <h3>On-chain messages:</h3>
      {messagesList.length === 0 && <p>No messages found</p>}

      {messagesList.map((m, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
          <p>{m.text}</p>
          <small>from {m.user.slice(0, 6)}... — {m.time}</small>
        </div>
      ))}
    </div>
  );
}
