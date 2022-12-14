//
import {
    Float16Array, isFloat16Array, isTypedArray,
    getFloat16, setFloat16,
    hfround,
} from "@petamoriken/float16";

//
const IsAbv = (value) => {
    return value && value.byteLength != undefined && (value instanceof ArrayBuffer);
}

//
const IsNumber = (index) => {
    return typeof index == "number" || typeof index == "bigint" || Number.isInteger(index) || typeof index == "string" && index.trim() != "" && /^\+?\d+$/.test(index.trim());
}

//
const EncoderUTF8 = new TextEncoder(); //U8Cache

//
String.prototype.vsplit = function(symbol){
    if (this != "") {
        return (this.startsWith(symbol) ? ["", ...this.substring(1).vsplit()] : this.split(symbol))||[this];
    }
    return [this];
}

// 
const AsBigInt = (value)=>{
    if (!value) {
        return 0n;
    } else
    if (IsNumber(value)) {
        return BigInt(value);
    } else
    if (ArrayBuffer.isView(value)) {
        return value.address();
    } else 
    if (value instanceof ArrayBuffer || value instanceof SharedArrayBuffer) {
        return value.address();
    } else 
    if (value instanceof Buffer) {
        return value.address();
    } else
    if (value instanceof Array || Array.isArray(value)) {
        return (new Types["u64[arr]"](value)).address(); // present as u64 array
    } else
    if (typeof value == "string") { // LTE - лучший тибетский интернет!
        const arrayBuffer = new ArrayBuffer((value = value + "\0").length);
        EncoderUTF8.encodeInto(value, new Uint8Array(arrayBuffer, 0, value.length));
        return arrayBuffer.address();
    } else 
    if (typeof value == "object" && value.address) {
        return value.address();
    }
    return BigInt(value);
}

//
const Types = {};

//
class TypePrototype {
    // for conversion struct or member
    _as(Target, tname, mname = "") {
        let length = 1;
        let offset = 0;
        let dfv = null;
        let type = null;

        if ((typeof tname == "object" || typeof tname == "function") && tname._type) {
            type = tname;
        } else

        if (typeof tname == "string") {
            if (tname.indexOf(";") >= 0) {
                [tname, dfv] = tname.vsplit(";");
                if (dfv == "undefined") dfv = null;
            };
            if (tname.indexOf("[") >= 0 && tname.indexOf("]") >= 0) {
                let match = tname.match(/\[(-?\d+)\]/);
                length = (match ? AsInt(match[1]) : 1) || 1;
                tname = tname.replace(/\[\d+\]/g, "");
            };
            if (tname.indexOf("(") >= 0 && tname.indexOf(")") >= 0) {
                let match = tname.match(/\((-?\d+)\)/);
                offset = (match ? AsInt(match[1]) : 0) || 0;
                tname = tname.replace(/\(\d+\)/g, "");
            };
        } else 

        if (typeof tname == "array") {
            length = tname[2] || 1;
            offset = tname[1] || 0;
            tname = tname[0];
        }

        if (IsNumber(mname)) { mname = AsInt(mname); };
        if (!type) { type = Types[tname+(length>1?"[arr]":"")] || Types[tname]; };
        return new type(Target.buffer, Target.byteOffset + offset + (Target.offsetof(mname)||0), (length||1));//[""];
    }

    get(Target, index) {
        if (index == "BYTES_PER_ELEMENT") { return Target[index]; }
        if (!isConstructor(Target)) {
            if (index == "") {
                return this._get ? this._get(Target) : new Proxy(Target, this);
                //return new Proxy(Target, this);
            } else
            if (IsNumber(index)) {
                return this._get ? this._get(Target, AsInt(index)) : Target[AsInt(index)];
            } else
            if (["byteLength", "byteOffset", "length", "_class"].indexOf(index) >= 0) {
                return Target[index];
            } else
            if (["address", "set", "offsetof", "bufferOffsetOf", "addressOffsetOf"].indexOf(index) >= 0) {
                return Target[index].bind(Target);
            } else 
            if (typeof index == "string") {
                let type = null; [index, type] = index.vsplit(":");
                return type ? Target._as(type, index)[""] : Target[index];
            } else {
                return this._get ? this._get(Target, index) : Target[index];
            }
        } else {
            if (index == "prototype") { return Target.prototype; };
            if (index == "_type") { return this._type; };
            if (index == "fromAddress") { return Target[index] ? Target[index].fromAddress(Target) : this[index].bind(this); }
            if (index == "byteLength") { return this.byteLength; };
        }
        return null;
    }

    set(Target, index, value) {
        //console.log(index, value, Target.set, Target);
        if (!isConstructor(Target)) {
            if (index == "") {
                if (Target.set) {
                    // I not able to avoid the LAVA
                    try {
                        Target.set(value); return true;
                    } catch(e) {
                        //console.warn(e);
                        return true;
                    }
                }
                return this._set ? this._set(Target, "", value) : (Target[""] = value);
            } else
            if (IsNumber(index)) {
                return this._set ? this._set(Target, AsInt(index), value) : (Target[AsInt(index)] = value);
            } else
            if (typeof index == "string" && index != "") {
                let type = null; [index, type] = index.vsplit(":");
                if (type) 
                    { Target._as(type, index)[""] = value; } else
                    { Target[index] = value; }
                return true;
            } else {
                return this._set ? this._set(Target, index, value) : (Target[index] = value);
            }
        }
    }
}

//
class TypeView {
    // for conversion struct or member
    as(...args) { return this._class._as(this, ...args)[""]; }

    // internal version of (without casting)
    _as(...args) { return this._class._as(this, ...args); }

    //
    bufferOffsetOf(name) { return this.byteOffset + this.offsetof(name); };
    addressOffsetOf(name) { return this.address() + BigInt(this.offsetof(name)); };
}

// Black Jack
let classes = [DataView, Uint8Array, Float16Array, Uint16Array, Uint32Array, BigUint64Array, Int8Array, Int16Array, Int32Array, BigInt64Array, Float32Array, Float64Array];
classes.map((C)=>{
    Object.defineProperty(C, "_class", { get() { return new TypePrototype(); }, configurable: true });
    Object.defineProperty(C.prototype, "_class", { get() { return new TypePrototype(); }, configurable: true });
    ["addressOffsetOf", "bufferOffsetOf", "as", "_as"].map((N)=>(C.prototype[N]=TypeView.prototype[N]));
    C.prototype.offsetof = function (index = 0) { return index * (this.BYTES_PER_ELEMENT || 0); };
});

//
class ConstructProxy extends TypePrototype {
    constructor(target) {
        super();
        this.target = target;
    }
    construct(_stub, args) {
        //new _stub(...args);
        let classed = null;
        if (typeof this.target == "string") {
            classed = new Types[this.target](...args);
        } else {
            classed = new this.target(...args);
        }
        return classed;
    }
}

//
function isConstructor(obj) {
    return !!obj.prototype && !!obj.prototype.constructor.name;
}

// 
class NumberAccessor extends TypePrototype {
    constructor(name, byteLength, get, set, construct_ = DataView, bigEndian = false) {
        super();

        if (!(name in Types)) { Types[name] = new Proxy(this._class = construct_, this); };
        this._type = name;
        this.bigEndian = bigEndian;
        this._get = get;//.bind(this);
        this._set = set;//.bind(this);
        this.byteLength = byteLength;
    }

    get(Target, index) {
        if (index == "BYTES_PER_ELEMENT") { return 1; } else
        if (index == "length") { return 1; } else
        { return super.get(Target, index); }
    }

    set(Target, index, value) {
        return super.set(Target, index, value);
    }

    construct(Target, args) {
        if (args.length >= 3) { args[2] = (args[2]||1) * this.byteLength; } else if (args.length >= 2) { args.push(this.byteLength); } else if (args.length >= 1) { args.push(0); args.push(this.byteLength); };
        const _class = new Target(...args);
        const self = this;
        Object.defineProperty(_class, "_class", { get() { return self; }, configurable: true });
        return new Proxy(_class, this);
    }
}

// 
class ArrayAccessor extends TypePrototype {
    constructor(name, byteLength, get, set, construct_, handler, bigEndian = false) {
        super();

        if (!((name+"[arr]") in Types)) { Types[name+"[arr]"] = new Proxy(this._class = construct_, this); };
        this._type = name+"[arr]";
        this.bigEndian = bigEndian;
        //this._get = (...args) => { return IsNumber(args[1]) ? get.bind(this)(...args) : new Proxy(args[0], this); }
        this._get = (...args) => { return IsNumber(args[1]) ? get.bind(this)(...args) : new Proxy(args[0], this); }
        this._set = (...args) => { return set.bind(this)(...args); /*return new Proxy(args[0], this);*/ }
        this.byteLength = byteLength;
        this.handler = handler;
        this.isArray = true;

        //
        const self = this;
        Object.defineProperty(construct_, "_class", { get() { return self; }, configurable: true });
        Object.defineProperty(construct_.prototype, "_class", { get() { return self; }, configurable: true });
    }

    get(Target, index) {
        return super.get(Target, index);
    }

    set(Target, index, value) {
        return super.set(Target, index, value);
    }

    construct(Target, args) {
        return new Proxy(new Target(...(this.handler ? this.handler(args) : args)), this);
    }
}

//
const AsInt = (index) => {
    return IsNumber(index) ? parseInt(index) : 0;
}

//
const AsFloat = (index) => {
    return IsNumber(index) ? parseFloat(index) : 0;
}

//
const getInt = (Target, index = 0) => {
    return Target[index];
}

//
const getBigInt = (Target, index = 0) => {
    return Target[index];
}

//
const getFloat = (Target, index = 0) => {
    return Target[index];
}

//
const setFloat = (Target, index = 0, value = 0) => {
    Target[index] = AsFloat(value); return true;
}

//
const setInt = (Target, index = 0, value = 0) => {
    Target[index] = AsInt(value); return true;
}

//
const setBigInt = (Target, index = 0, value = 0n) => {
    Target[index] = AsBigInt(value); return true;
}

// default accessor types
new NumberAccessor("u8", 1, (dv, offset=0)=>{ return dv.getUint8(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setUint8(AsInt(offset)||0, AsInt(value), true); return true; });
new NumberAccessor("i8", 1, (dv, offset=0)=>{ return dv.getInt8(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setInt8(AsInt(offset)||0, AsInt(value), true); return true; });
new NumberAccessor("f16", 2, (dv, offset=0)=>{ return dv.getFloat16(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setFloat16(AsInt(offset)||0, AsFloat(value), true); return true; });
new NumberAccessor("u16", 2, (dv, offset=0)=>{ return dv.getUint16(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setUint16(AsInt(offset)||0, AsInt(value), true); return true; });
new NumberAccessor("i16", 2, (dv, offset=0)=>{ return dv.getInt16(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setInt16(AsInt(offset)||0, AsInt(value), true); return true; });
new NumberAccessor("f32", 4, (dv, offset=0)=>{ return dv.getFloat32(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setFloat32(AsInt(offset)||0, AsFloat(value), true); return true; });
new NumberAccessor("u32", 4, (dv, offset=0)=>{ return dv.getUint32(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setUint32(AsInt(offset)||0, AsInt(value), true); return true; });
new NumberAccessor("i32", 4, (dv, offset=0)=>{ return dv.getInt32(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setInt32(AsInt(offset)||0, AsInt(value), true); return true; });
new NumberAccessor("f64", 8, (dv, offset=0)=>{ return dv.getFloat64(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setFloat64(AsInt(offset)||0, AsFloat(value), true); return true; });
new NumberAccessor("u64", 8, (dv, offset=0)=>{ return dv.getBigUint64(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setBigUint64(AsInt(offset)||0, AsBigInt(value), true); return true; });
new NumberAccessor("i64", 8, (dv, offset=0)=>{ return dv.getBigInt64(AsInt(offset)||0, true); }, (dv, offset, value)=>{ dv.setBigInt64(AsInt(offset)||0, AsBigInt(value), true); return true; });
new NumberAccessor("u24", 3, 
(dv, offset=0)=>{ return (dv.getUint8(AsInt(offset)||0, true)|(dv.getUint8((AsInt(offset)||0)+1, true)<<8)|(dv.getUint8((AsInt(offset)||0)+2, true)<<16)); }, 
(dv, offset, value)=>{ dv.setUint8(AsInt(offset)||0, (AsInt(value) & 0xFF), true); dv.setUint8((AsInt(offset)||0)+1, (AsInt(value) >> 8) & 0xFF, true); dv.setUint8((AsInt(offset)||0)+2, (AsInt(value) >> 16) & 0xFF, true); return true; });

//
const re64 = (args)=>{
    if (typeof args[0] == "array" || Array.isArray(args[0])) { return [args[0].map(AsBigInt)] };
    if (IsNumber(args[0])) { return [AsInt(args[0])]; };
    if (IsAbv(args[0]?.buffer || args[0])) { // PMV
        if (args.length < 2) { args.push(0); };
        if (args.length < 3) { args.push(1); };
        return args;
    }
    return args;
}

//
const rei = (args)=>{
    if (IsNumber(args[0])) { return [AsInt(args[0])]; };
    if (IsAbv(args[0]?.buffer || args[0])) { // PMV
        if (args.length < 2) { args.push(0); };
        if (args.length < 3) { args.push(1); };
        return args;
    }
    return args;
}

//
const ref = (args)=>{
    if (IsNumber(args[0])) { return [AsInt(args[0])]; };
    if (IsAbv(args[0]?.buffer || args[0])) { // PMV
        if (args.length < 2) { args.push(0); };
        if (args.length < 3) { args.push(1); };
        return args;
    }
    return args;
}

// default array types
new ArrayAccessor("u8", 1, getInt, setInt, Uint8Array, rei);
new ArrayAccessor("i8", 1, getInt, setInt, Int8Array, rei);
new ArrayAccessor("f16", 2, getInt, setInt, Float16Array, ref);
new ArrayAccessor("u16", 2, getInt, setInt, Uint16Array, rei);
new ArrayAccessor("i16", 2, getInt, setInt, Int16Array, rei);
new ArrayAccessor("f32", 4, getFloat, setFloat, Float32Array, ref);
new ArrayAccessor("u32", 4, getInt, setInt, Uint32Array, rei);
new ArrayAccessor("i32", 4, getInt, setInt, Int32Array, rei);
new ArrayAccessor("f64", 8, getFloat, setFloat, Float64Array, ref);
new ArrayAccessor("u64", 8, getBigInt, setBigInt, BigUint64Array, re64);
new ArrayAccessor("i64", 8, getBigInt, setBigInt, BigInt64Array, re64);

// 
class CStructView extends TypeView {
    constructor(buffer, byteOffset = 0, length = 0, struct = null) {
        super();

        this.buffer = buffer;
        this.byteOffset = byteOffset + struct.byteOffset;
        this.byteLength =     length * struct.byteLength;
        this._type = struct._type;
        this._parent = null;
        this.length = length;

        // implicit support for type-casting and setting
        Object.defineProperties(this, {
            [""]: {
                set: (v)=>{ this.set(v); },
                get: ()=>{ return new Proxy(this, this._class)[""]; },
                configurable: true
            }
        });

        //
        (this._class = struct)._types.forEach((tp)=>{
            // use F32 fallback for Vulkan API types
            const array = new (tp.type || Types[length > 1 ? "u32[arr]" : "u32"])(this.buffer, this.byteOffset + tp.byteOffset, tp.length);

            //array._parent = this; // prefer to have parent node
            Object.defineProperties(this, {
                [tp.name]: {
                    set: (v)=>{ array[""] = v; },
                    get: ()=>{ return array[""]; },
                    configurable: true
                }
            });

            // if has default value, but not set already
            if (tp.dfv != undefined && tp.dfv !== null && !this[tp.name]) { 
                this[tp.name] = tp.dfv;

                if (this.length > 1) {
                    let structed = new Proxy(this, this._class);
                    for (let I=1;I<this.length;I++) { if (!structed[I][tp.name]) { structed[I][tp.name] = tp.dfv; } };
                }
            };
        });

        // re-bind for native
        this.address = this.address.bind(this);
    }


    // fix extra vars problems, make as object and read-only de-facto
    serialize() {
        let obj = {};
        for (let t of this._class._types) { 
            obj[t.name] = typeof this[t.name].serialize == "function" ? this[t.name].serialize() : this[t.name];
        };
        return obj;
    }

    // member utils
    lengthof(name) { return this._class.lengthof(name); };
    offsetof(name) { return this._class.offsetof(name); };

    //
    set(buffer, offset = 0) {
        // prefer a proxy
        let structed = new Proxy(this, this._class);

        //
        if (Array.isArray(buffer)) {
            for (let I=0;I<buffer.length;I++) {
                structed[I] = buffer[I];
            }
        } else
        if (typeof buffer == "object") {
            // serialization are required for avoid keys conflicts
            let types = [], raws = [];
            let keys = Object.keys(typeof buffer.serialize == "function" ? buffer.serialize() : buffer).map((k,i)=>{ 
                raws.push(k); let names = k.vsplit(":");
                types.push(names[1]); return names[0];
            });

            // needs votes and feedback!
            // supports correct order
            for (let t of this._class._types) { 
                let k = t.name, f = keys.indexOf(k), type = types[f];
                //if (f >= 0) structed[raws[f]] = (buffer[k] || buffer[raws[f]]); // may to assign as is
                if (f >= 0) structed[raws[f]] = (buffer[raws[f]] || buffer[k]); // may to typecast when getting firstly
            };
            return structed;
        }
        return this;
    }

    address() {
        return this.buffer.address() + BigInt(this.byteOffset);
    }
}

// 
class CStruct extends TypePrototype {
    constructor(name, struct, byteLength) {
        super();

        this._struct = struct;
        this._type = name;
        this.byteOffset = 0;
        this.byteLength = byteLength || 0;
        this._isStruct = true;
        if (!(name in Types)) { this._class = Types[name] = new Proxy(CStructView, this); };
    }

    gerenateTypeTable() {
        if (!this._types) { this._types = [];
            const name = this._type, struct = this._struct, byteLength = this.byteLength;
            
            let prev = undefined;
            for (let name in struct) {
                let length = 1;
                let offset = 0;
                let tname = null;
                let type = null;
                let dfv = null;

                if ((typeof struct[name] == "object" || typeof struct[name] == "function") && struct[name].type) {
                    type = struct[name];
                } else
                if (typeof struct[name] == "string") {
                    tname = struct[name];

                    if (tname.indexOf(";") >= 0) {
                        let names = tname.vsplit(";");
                        tname = names[0];
                        if (names.length >= 2 && names[1] && names[1] != "undefined") {
                            dfv = JSON.parse(names[1]);//JSON.parse(`{"_stub":${names[1]||0}}`)["_stub"];
                        }
                    };
                    if (tname.indexOf("[") >= 0 && tname.indexOf("]") >= 0) {
                        let match = tname.match(/\[(-?\d+)\]/);
                        length = (match ? AsInt(match[1]) : 1) || 1;
                        tname = tname.replace(/\[\d+\]/g, "");
                    };
                    if (tname.indexOf("(") >= 0 && tname.indexOf(")") >= 0) {
                        let match = tname.match(/\((-?\d+)\)/);
                        offset = (match ? AsInt(match[1]) : 0) || 0;
                        tname = tname.replace(/\(\d+\)/g, "");
                    };
                    
                } else 
                if (typeof struct[name] == "array") {
                    length = struct[name][2] || 1;
                    offset = struct[name][1] || 0;
                    if (typeof struct[name] == "object" && struct[name].type) {
                        type = struct[name][0];
                    } else {
                        tname = struct[name][0];
                    }
                }

                // correctify offset, if not defined
                if (!offset && prev != undefined) { offset = this._types[prev].byteOffset + this._types[prev].byteLength; }; 
                if (!type) { type = Types[tname+(length>1?"[arr]":"")] || Types[tname]; }; // fallback by not-arrayed

                //
                prev = this._types.length; this._types.push({type, dfv, name, length, byteOffset: offset, byteLength: (type?.byteLength || type?.BYTES_PER_ELEMENT || 1) * length });

                //
                this._types = this._types.sort(function(a, b) {
                    if (a.byteOffset < b.byteOffset) return -1;
                    if (a.byteOffset > b.byteOffset) return 1;
                    return 0;
                });
            }

            // if length is not defined
            if (!this.byteLength && this._types.length >= 1) { 
                this.byteLength = this._types[this._types.length-1].byteOffset + this._types[this._types.length-1].byteLength; 
            }
        }
        
    }

    fromAddress(address, length=1) {
        return new this._class(ArrayBuffer.fromAddress(AsBigInt(address), length * this.byteLength), 0, length * this.byteLength);
    }

    get(Target, index) {
        if (!isConstructor(Target)) {
            if (index != "" && ["bufferOffsetOf", "addressOffsetOf", "serialize"].indexOf(index) >= 0) { return Target[index].bind(Target); }
            if (IsNumber(index)) {
                return new this._class(Target.buffer, Target.byteOffset + this.byteLength * AsInt(index), (Target.length||1) - AsInt(index))[""];
            } else 
            if (typeof index == "string" && index != "") {
                let type = null; [index, type] = index.vsplit(":");
                if (index == "" || Target._class._types.find((t)=>(t.name==index))) {
                    return type ? Target._as(type, index)[""] : Target[index];
                }
            }
        } else {
            this.gerenateTypeTable();
        }
        return super.get(Target, index);
    }

    set(Target, index, value) {
        if (!isConstructor(Target)) {
            if (IsNumber(index)) {
                new this._class(Target.buffer, Target.byteOffset + this.byteLength * AsInt(index), (Target.length||1) - AsInt(index))[""] = value;
                return true;
            } else
            if (typeof index == "string" && index != "") {
                let type = null; [index, type] = index.vsplit(":");
                if (index == "" || Target._class._types.find((t)=>(t.name==index))) {
                    if (type) 
                        { Target._as(type, index)[""] = value; } else
                        { Target[index] = value; }
                }
                return true;
            }
        }
        return super.set(Target, index, value);
    }

    lengthof(name) {
        this.gerenateTypeTable();
        let type = this._types.find((e)=>(e.name==name)) || this;
        return (type?.byteLength || 1) / (type?.BYTES_PER_ELEMENT || 1);
    }

    offsetof(name) {
        this.gerenateTypeTable();
        if (IsNumber(name)) { // panty
            return AsInt(name) * this.byteLength;
        } else 
        if (typeof name == "string") { // stringy
            return (this._types.find((e)=>(e.name==name)) || this)?.byteOffset || 0;
        }
        return 0;
    }

    // 
    construct(Target, args) {
        this.gerenateTypeTable();

        //
        let [buffer, byteOffset, length] = args; byteOffset ||= 0, length ||= 1; // NEW syntax!
        let cargs = [];
        if (IsAbv(buffer ? (buffer.buffer || buffer) : null)) {
            cargs = [buffer.buffer || buffer, (buffer.byteOffset||0) + byteOffset, length || 1];
        } else 
        if (typeof buffer == "number") {
            cargs = [new ArrayBuffer((this.byteLength * buffer) || 1), 0, buffer || 1];
        } else 
        if (Array.isArray(buffer)) {
            cargs = [new ArrayBuffer((this.byteLength || 1) * (buffer.length || 1)), 0, buffer.length || 1];
        } else 
        if (typeof buffer == "object") {
            cargs = [new ArrayBuffer(this.byteLength || 1), 0, 1];
        } else 
        {
            cargs = [new ArrayBuffer(this.byteLength || 1), 0, 1];
        }
        const result = new Proxy(new CStructView(...cargs, this), this);
        if (Array.isArray(buffer)) { result.set(buffer); } else
        if (typeof buffer == "object") { result.set(buffer); };
        return result;
    }
}

//
export default { CStruct, CStructView, Types, ConstructProxy, AsBigInt, IsNumber, EncoderUTF8 };
