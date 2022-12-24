# 🧩 Typed JS 🧩

Dedicated project of `typed.js` script from `vulkan.node.js`

### Features

- Static types support, such as `u8`, `i8`, `u16`, `i16`, `u32`, `i32`, `u64`, `i64`, `f32`, `f64`, etc.
- Support for typed arrays by `[arr]` typed and `[N]` declaraton, where `N` is any number.
- Support for manually offsets by `(O)` where `O` is any number.
- Support for inline typecasting, such as `member:f32` or `member:f32[2]`, structs also supported.
- Support types namespace in special registry. 

### Examples

Main example: https://github.com/hydra2s/vulkan.node.js/blob/main/examples/triangle/index.js

Here present is not all possible examples.

```js
const Vec2 = new Proxy(CStructView, new CStruct("Vec2", {
    x: "f32", y: "f32"
}));

const StructExample = new Proxy(CStructView, new CStruct("StructExample", {
    memberArr: "u32[2]", 
    member: "f32", 
    memberStruct: "Vec2"
}));

const structed = new Types["StructExample"]({
    memberArr: [0, 0],
    member: 0,
    memberVec2: {x: 0, y: 0}
});

// classic assign
structed.memberVec2 = { x: 1, y: 0 };

// semi-assign
structed.memberVec2 = { y: 2 };

// array based assign
structed["memberVec2:f32[2]"] = [2, 1];

// inline assign with typecasting, also you can use `set(obj)` function
structed[""] = {
    member: 1,
    ["memberVec2:f32[2]"]: [1, 2]
}

// assign first member as u32
structed[":u32"] = 1;

// not checked or tested, but assign with byte offsets
structed[":u32(4)"] = 2;

```

## Projects

### 🥀 [about](https://github.com/hydra2s-info/about), our idiology
### 📀 [vk-utils](https://github.com/hydra2s/vk-utils), our helpers for Vulkan API development 
### 🍵 [Node.JS Vulkan API](https://github.com/hydra2s/node-vulkan-api), our nodejs bindings (alike LWJGL)
### 🖥️ [LG-24UD58-EDID-FIX](https://github.com/hydra2s/LG-24UD58-EDID-FIX), EDID fix for our monitor
### 📻 [WS-Comlink](https://github.com/hydra2s/ws-comlink), our comlink JS protocol
### 🧩 [Typed.js](https://github.com/hydra2s/typed.js), our struct JS library
### 👩‍🎤 [Noire.js](https://github.com/hydra2s/noire.js), our new renderer, based on JS
