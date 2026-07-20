# LepusWeb - LEPUS-8 Microcomputer Emulator

LepusWeb is a complete, in-browser assembler and emulator for the LEPUS-8, a custom 8-bit microcomputer architecture. It allows you to write assembly code, compile it directly in the browser, and step through the execution visually.

![PLACEHOLDER: Image of Main Window only](/images/main.png)

## Features

* **Custom 8-bit Architecture:** Features 256 bytes of memory divided into strict zones (Program, Stack, Scratchpad, and Video).
* **Domain-Specific Registers:** Three main registers (A, B, C) dedicated to Arithmetic, Bitwise logic, and Shifting operations.
* **Memory-Mapped Graphics:** A 24x24 pixel monochrome display mapped directly to the 0xB8 to 0xFF memory range.
* **Live Debugging:** Watch registers, memory cells, and CPU flags update in real time as your program executes.
* **Variable Execution Speed:** Step through code line by line, run at a readable speed, or use Turbo Mode to execute intense loops instantly.

![PLACEHOLDER: Image of Emoji display](/images/smiley.png)

## Documentation and Tutorial

If you are new to the LEPUS-8 architecture or want to learn how to write assembly for this system, please read the official documentation:

[LEPUS-8 Instruction Set Glossary and Tutorial](https://bitflipper19.github.io/LepusWeb/glossary.html)

The glossary includes a detailed breakdown of the memory map, registers, addressing modes (including indirect pointers), and a complete table of every supported assembly instruction.

## Play Now

The emulator is deployed and runs entirely on the client side in your web browser. You can try it directly here:

[https://bitflipper19.github.io/LepusWeb/](https://bitflipper19.github.io/LepusWeb/)