import {useRef} from "react";
import {useIsoContext} from "isoq";
import FS from '@isomorphic-git/lightning-fs';

async function run() {
    let fs=new FS("testfs");
    /*await fs.promises.writeFile("/hello","hello-world");
    await fs.promises.writeFile("/hello2","hello-world2");*/

    let content=await fs.promises.readFile("/hello","utf8");
    console.log(content);

    let content2=await fs.promises.readFile("/hello2","utf8");
    console.log(content2);

}

export default function() {
    let ref=useRef();
    let iso=useIsoContext();

    if (!ref.current && !iso.isSsr()) {
        ref.current=true;
        run();
    }

    return (<>
        <div>Hello World</div>
        <div>The project begins here...</div>
    </>);
}
