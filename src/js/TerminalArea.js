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
var curr_input = "[]> "; //var to keep track of user input in the terminal
let cursorIndex = 4

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

// Possible operations causing cursor to move (hence update prevMatch, )

//User input in terminal
term.onKey((key) => {
  const char = key.domEvent.key;
  key.domEvent.preventDefault();

  // console.log("this qunatity", curr_input.slice(4, cursorIndex))

  let prevMatch = curr_input.slice(4, cursorIndex).match(/\s*\S+\s*$/);
  let afterMatch = curr_input.slice(cursorIndex).match(/\s*\S+\s*$/);
  console.log("cur", cursorIndex)

  //if 'enter' send curr_input to server
  if (char === "Enter") {
    term.write("\r\n");
    sendTerminalValues();
    console.log("curr_input", curr_input)

    if (curr_input.trim() !== "") {
      commandHistory.push(curr_input);
      historyIndex = commandHistory.length;
    }

    curr_input = "[]> ";
    cursorIndex = 4;
  }
  else if (char === "c" && key.domEvent.ctrlKey) {
    term.write("c\r\n");
    curr_input = "[]> ";
    cursorIndex = 4;
  }
  // skipping word using option (alt)
  else if (char === "ArrowLeft" && key.domEvent.altKey) {
    if (prevMatch) {
      const charsToMove = prevMatch[0].length; // Characters to move back
      term.write("\x1b[D".repeat(charsToMove)); // Move terminal cursor back
      curr_input = curr_input.slice(0, cursorIndex - charsToMove) + curr_input.slice(cursorIndex); // Update cursor position logic
    }
  } else if (char === "ArrowRight" && key.domEvent.altKey) {
    if (afterMatch) {
      const charsToMove = afterMatch[0].length; // Characters to move forward
      term.write("\x1b[C".repeat(charsToMove)); // Move terminal cursor forward
      curr_input = curr_input.slice(0, cursorIndex) + curr_input.slice(cursorIndex + charsToMove); // Update cursor position logic
    }
  }
  //if 'left arrow' go back a character
  else if (char === "ArrowLeft") { // []> 
    if (cursorIndex > 4) { // same as curr_input.length > 4
      term.write("\x1b[D");
      cursorIndex--;
    }
  }
  //if 'right arrow' go forward a character
  else if (char === "ArrowRight") {
    if (cursorIndex < curr_input.length) {
      term.write("\x1b[C");
      cursorIndex++;
    }
  }
  //if 'up arrow' retrieve previous command
  else if (char === "ArrowUp") {
    if (historyIndex > 0) {
      historyIndex--;
      const promptCommand = commandHistory[historyIndex]
      const previousCommand = promptCommand.substring(4);

      term.write("\r\x1b[K" + promptCommand);
      curr_input = previousCommand;

      cursorIndex = curr_input.length - 1;
    }
  }
  //if 'down arrow' go down a line
  else if (char === "ArrowDown") {
    if (historyIndex < commandHistory.length - 1) {
      // Move to the next command in history
      historyIndex++;
      const promptCommand = commandHistory[historyIndex]
      const nextCommand = promptCommand.substring(4);

      // Clear the current line and show the next command
      term.write("\r\x1b[K" + promptCommand);
      curr_input = nextCommand;

      cursorIndex = curr_input.length - 1;
    }
  }
  // control + backspace to delete
  else if ((char === "Backspace" || char === "Delete") && key.domEvent.ctrlKey) {
    if (prevMatch && curr_input.length > 4) {
      const charsToDelete = prevMatch[0].length;
      curr_input = curr_input.slice(0, cursorIndex - charsToDelete) + curr_input.slice(cursorIndex);
      cursorIndex -= charsToDelete;
      // remove char from the display
      term.write("\b \b".repeat(charsToDelete));
    }
  }
  //if 'backspace' delete a char on both curr_input and terminal, but not the []> 
  else if (char === "Backspace" || char === "Delete") {
    if (curr_input.length > 4 && cursorIndex > 4) { // disable the deletion of "[]> "
      curr_input = curr_input.slice(0, cursorIndex - 1) + curr_input.slice(cursorIndex);
      cursorIndex--;
      console.log(cursorIndex, curr_input)

      term.write("\x1b[2K\r"); // Clear the line
      term.write(curr_input); // Rewrite the updated input
      let shift = curr_input.length - cursorIndex;
      if (shift > 0) {
        term.write(`\x1b[${shift}D`); // Move cursor left by `shift` positions
      }
    }
  }
  // else add char to both curr_input and terminal
  else {
    term.write(char);
    curr_input += char;
    ++cursorIndex;
  }
  // prevMatch = curr_input.slice(4, cursorIndex).match(/\s*\S+\s*$/);
  // afterMatch = curr_input.slice(cursorIndex).match(/\s*\S+\s*$/);
  // console.log(char, cursorIndex, prevMatch, afterMatch);
  console.log(cursorIndex);
});

// Copy and paste
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
      }).catch();
  }
});


//helper function to send terminal values to server
function sendTerminalValues() {
  var msg = {
    type: "user",
    text: curr_input.substring(3), // crop off "[]> "
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
