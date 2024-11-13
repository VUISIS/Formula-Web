/**
 *  @fileoverview Creates the functionality for the terminal area.
 */

import React, { useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useCollapse } from "react-collapsed";

const { ws } = require("./configSocket.js"); //get the ws connection initialized in configSocket.js

//initialize Xterm.js
const fitAddon = new FitAddon();
var curr_input = ""; //var to keep track of user input in the terminal

var term = new Terminal({
  //cursor and '\r' for every new line
  cursorBlink: true,
  cursorStyle: "block",
  convertEol: true,
});

var commandHistory = []
let historyIndex = -1;

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
  key.domEvent.preventDefault();
  //if 'enter' send curr_input to server
  if (char === "Enter") {
    term.write("\r\n");
    sendTerminalValues();

    if (curr_input.trim() !== "") {
      commandHistory.push("[]> " + curr_input);
      historyIndex = commandHistory.length;
    }

    curr_input = "";
  }
  //if 'backspace' delete a char on both curr_input and terminal
  else if (char === "Backspace" || char === "Delete") {
    term.write("\b \b");
    curr_input = curr_input.substring(0, curr_input.length - 1);
  }
  //if 'left arrow' go back a character
  else if (char == "ArrowLeft") {
    term.write("\x1b[D");
  }
  //if 'right arrow' go forward a character
  else if (char == "ArrowRight") {
    term.write("\x1b[C");
  }
  //if 'up arrow' retrieve previous command
  else if (char == "ArrowUp") {
    if (historyIndex > 0) {
      historyIndex--;
      const promptCommand = commandHistory[historyIndex]
      const previousCommand = promptCommand.substring(4);

      term.write("\r\x1b[K" + promptCommand);
      curr_input = previousCommand;
    }
  }
  //if 'down arrow' go down a line
  else if (char == "ArrowDown") {
    if (historyIndex < commandHistory.length - 1) {
      // Move to the next command in history
      historyIndex++;
      const promptCommand = commandHistory[historyIndex]
      const nextCommand = promptCommand.substring(4);

      // Clear the current line and show the next command
      term.write("\r\x1b[K" + promptCommand);
      curr_input = nextCommand;
    }
  }
  //else add char to both curr_input and terminal
  else {
    term.write(char);
    curr_input += char;
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
    if (term.hasSelection()) {
      navigator.clipboard.writeText(term.getSelection()).then(
        () => { }, () => { }
      );
    }
  } else if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
    navigator.clipboard.readText().then(
      (text) => {
        term.write(text);
        curr_input += text;
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
      <div class="header">Common Commands</div>
      <div class="content">
        <p>
          <b>Solving:</b>
        </p>
        <blockquote>
          <code>
            solve x = pm // Try to complete the partial model named pm
          </code>
        </blockquote>

        <p>
          <b>Queries:</b>
        </p>
        <blockquote>
          <code>query m badMapping // Does model m have a badMapping?</code>
        </blockquote>

        <p>
          <b>Display task status:</b>
        </p>
        <blockquote>
          <code>list</code>
        </blockquote>

        <p>
          <b>Proofs:</b>
        </p>
        <blockquote>
          <code>pr 0 //Show a proof for task 0</code>
        </blockquote>

        <p>
          <b>Help:</b>
        </p>
        <blockquote>
          <code>help //displays available commands</code>
        </blockquote>
      </div>
    </>
  );
}

export default TerminalArea;
