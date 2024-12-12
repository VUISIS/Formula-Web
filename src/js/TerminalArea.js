import React, { useRef, useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useCollapse } from "react-collapsed";
const { ws } = require("./configSocket.js"); //get the ws connection initialized in configSocket.js

//initialize Xterm.js
const fitAddon = new FitAddon();
var curr_input = ""; //var to keep track of user input in the terminal
var commandHistory = []; // Array to store command history
var historyIndex = -1; // Index to navigate through command history
const prompt = "[]>"

var term = new Terminal({
  //cursor and '\r' for every new line
  cursorBlink: true,
  cursorStyle: "block",
  convertEol: true,
});

document.addEventListener("DOMContentLoaded", function () {
  //open terminal and resize it to fit its container properly
  term.open(document.getElementById("terminal"));
  term.loadAddon(fitAddon);
  fitAddon.fit();
});

//resize the terminal whenever the window is resized
addEventListener("resize", (event) => {
  term.loadAddon(fitAddon);
  fitAddon.fit();
});

//resize the terminal whenever the window is loaded
window.addEventListener("load", (event) => {
  term.loadAddon(fitAddon);
  fitAddon.fit();
});

//User input in terminal
term.onKey((key) => {
  const char = key.domEvent.key;
  const event = key.domEvent;
  console.log(`Key pressed: ${char}, Meta: ${event.metaKey}, Shift: ${event.shiftKey}, Control: ${event.ctrlKey}`);

  // Command + Shift + Left/Right (select entire line)
  if (event.metaKey && event.shiftKey && (char === 'ArrowLeft' || char === 'ArrowRight')) {
    // Select entire line
    term.selectAll();
    return;
  }

  // Control + Left/Right (move by character)
  if (event.altKey && (char === 'ArrowLeft' || char === 'ArrowRight')) {
    if (char === 'ArrowLeft') {
      term.write('\x1b[D'); // Move cursor left
    } else {
      term.write('\x1b[C'); // Move cursor right
    }
    return;
  }

  // Control + Delete (delete current character)
  if (event.ctrlKey && char === 'Delete') {
    term.write('\x1b[P'); // Delete character at cursor
    curr_input = curr_input.substring(0, curr_input.length - 1);
    return;
  }

  // Existing key handling
  if (char === "Enter") {
    term.write("\r\n");
    sendTerminalValues();
    commandHistory.push(curr_input);
    historyIndex = commandHistory.length;
    curr_input = "";
  }
  
  //Handle backspace and stops at prompt "[]>"
  else if (char === "Backspace" || char === "Delete") {
    const handleBackspace = () => {
      // Get current line content
      const currentLine = term.buffer.active.getLine(term.buffer.active.cursorY).translateToString();
      const cursorX = term.buffer.active.cursorX;

      // Only allow backspace if we're beyond the prompt
      if (cursorX > prompt.length) {
        term.write("\b \b");
      }
    }
    handleBackspace();
  }

  else if (char == "ArrowLeft") {
    term.write("\x1b[D");
  }

  else if (char == "ArrowRight") {
    term.write("\x1b[C");
  }

  else if (char == "ArrowUp") {
    if (historyIndex > 0) {
      historyIndex--;
      const prevCommand = commandHistory[historyIndex];
      term.write("\r\x1b[K" + prompt + " " + prevCommand);
      curr_input = prevCommand;
    }
  }
  else if (char == "ArrowDown") {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      const nextCommand = commandHistory[historyIndex];
      term.write("\r\x1b[K" + prompt + " " + nextCommand);
      curr_input = nextCommand;
    } else {
      historyIndex = commandHistory.length;
      curr_input = "";
      term.write("\r\x1b[K" + prompt);
    }
  }
  else {
    term.write(char);
    curr_input += char;
  }
});

// new copy and paste 
document.addEventListener("keydown", function(e) {
  if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
    console.log("Command + C detected");
    if (term.hasSelection()) {
      navigator.clipboard.writeText(term.getSelection()).then(
        () => { console.log("Text copied"); }, 
        () => { console.log("Copy failed"); }
      );
    }
  } else if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
    console.log("Command + V detected");
    navigator.clipboard.readText().then(
      (text) => {
        term.write(text);
        curr_input += text;
        console.log("Text pasted");
      }).catch((e) => {
        console.log("Paste failed", e);
      });
  }
});

//helper function to send terminal values to server
function sendTerminalValues() {
  var msg = {
    type: "user",
    text: curr_input,
  };
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

//the main functionality of the terminal area
function TerminalArea() {
  //function for when ws receives a message from the server
  ws.onmessage = (event) => {
    const messages = JSON.parse(event.data);
    //write the result to Xterm.js
    term.write(messages.text);
  };

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse();

  //return the html for the terminal area
  return (
    <>
      <div id="terminal"></div>
      <div className="commands-container">
        <h2 className="commands-header">Common Commands</h2>
        <div className="commands-content">
          <div className="command-section">
            <h3>Solving</h3>
            <div className="command-block">
              <code>solve x = pm</code>
              <span className="command-description">Try to complete the partial model named pm</span>
            </div>
          </div>

          <div className="command-section">
            <h3>Queries</h3>
            <div className="command-block">
              <code>query m badMapping</code>
              <span className="command-description">Does model m have a badMapping?</span>
            </div>
          </div>

          <div className="command-section">
            <h3>Display Task Status</h3>
            <div className="command-block">
              <code>list</code>
            </div>
          </div>

          <div className="command-section">
            <h3>Proofs</h3>
            <div className="command-block">
              <code>pr 0</code>
              <span className="command-description">Show a proof for task 0</span>
            </div>
          </div>

          <div className="command-section">
            <h3>Help</h3>
            <div className="command-block">
              <code>help</code>
              <span className="command-description">Displays available commands</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TerminalArea;