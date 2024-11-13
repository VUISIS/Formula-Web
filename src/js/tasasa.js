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
    console.log(`Key pressed: ${char}, Meta: ${key.domEvent.metaKey}`); // key pressed to console
    //if 'enter' send curr_input to server
    if (char === "Enter") {
        term.write("\r\n");
        sendTerminalValues();
        commandHistory.push(curr_input); // Add command to history
        historyIndex = commandHistory.length; // Reset history index
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
    //if 'up arrow' go to the previous command
    else if (char == "ArrowUp") {
        if (historyIndex > 0) {
            historyIndex--;
            curr_input = commandHistory[historyIndex];
            term.write("\r\x1b[K" + curr_input); // Clear line and write the previous command
        }
    }
    //if 'down arrow' go to the next command
    else if (char == "ArrowDown") {
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            curr_input = commandHistory[historyIndex];
            term.write("\r\x1b[K" + curr_input); // Clear line and write the next command
        } else {
            historyIndex = commandHistory.length;
            curr_input = "";
            term.write("\r\x1b[K"); // Clear line
        }
    }
    //else add char to both curr_input and terminal
    else {
        term.write(char);
        curr_input += char;
    }
});
// new copy and paste
document.addEventListener("keydown", function (e) {
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
            <div className="header">Common Commands</div>
            <div className="content">
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
