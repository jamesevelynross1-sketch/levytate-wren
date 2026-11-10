/** Actual shared recovery components and public login GET only; no Auth claim. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import { observeBrowserEvent } from "./release-workspace-recovery-browser.mjs";

const {values}=parseArgs({options:{browser:{type:"string"},playwright:{type:"string"}},strict:true});
assert(isAbsolute(values.browser??"")&&isAbsolute(values.playwright??""),"Explicit local browser paths required");
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),app="http://localhost:3107";
// Match the inspected Next browser bundle's provided process shim. A bare
// esbuild fixture raised missing process/__dirname before opening anything;
// those fixture failures are not evidence of an application popup defect.
const bundle=await build({stdin:{contents:`import process from "next/dist/build/polyfills/process";globalThis.process=process;import React from "react";import{createRoot}from"react-dom/client";import{MvpWorkspaceProvider}from"./components/levytate-mvp/MvpWorkspaceStore";import{ClientMutationRecovery}from"./components/levytate-mvp/ClientMutationRecovery";import{createEmptyMvpWorkspace}from"./lib/levytate/mvp/workspace";import{permissionsForMvpRole}from"./lib/levytate/mvp/rbac";const initialWorkspace={data:createEmptyMvpWorkspace(),meta:{organisationId:"10000000-0000-4000-8000-000000000001",organisationName:"Synthetic probe",userEmail:"synthetic@example.test",userRole:"Employee",permissions:permissionsForMvpRole("Employee"),storageMode:"supabase",warnings:[]}};createRoot(document.getElementById("root")).render(<MvpWorkspaceProvider initialWorkspace={initialWorkspace}><form><fieldset disabled><label>Retained answer<textarea value="Synthetic original answer" readOnly/></label></fieldset></form><ClientMutationRecovery mutation={{working:false,pending:true,error:"Sign in again before retrying.",retry:()=>{}}}/></MvpWorkspaceProvider>);`,resolveDir:root,loader:"tsx"},absWorkingDir:root,bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"',global:"globalThis",__dirname:'"/"'},logLevel:"silent"});
const server=createServer((request,response)=>{if(request.url==="/levytate/login"){response.writeHead(302,{Location:`${app}/levytate/login`});response.end();return;}response.setHeader("Content-Type",request.url==="/bundle.js"?"text/javascript":"text/html");response.end(request.url==="/bundle.js"?bundle.outputFiles[0].text:'<!doctype html><div id="root"></div><script src="/bundle.js"></script>');});
let browser,stage="listen",authPosts=0;
const observations={clickCompleted:false,newPageEvents:0,pageErrors:[],openCalls:0,publicLoginGets:0};
try{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 const {chromium}=await import(pathToFileURL(values.playwright).href);browser=await chromium.launch({headless:true,executablePath:values.browser});const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(10000);context.setDefaultTimeout(10000);context.on("page",()=>{observations.newPageEvents++;});page.on("pageerror",error=>observations.pageErrors.push({name:["TypeError","ReferenceError"].includes(error.name)?error.name:"Error",category:error.message.match(/^[A-Za-z_$][A-Za-z0-9_$]* is not defined$/)?.[0]??"unclassified"}));
 await page.exposeFunction("recordOpen",()=>{observations.openCalls++;});
 await page.addInitScript(()=>{const original=window.open;window.open=function(...args){void window.recordOpen();return original.apply(this,args);};});
 const probe=`http://127.0.0.1:${server.address().port}`;
 await context.route("**/*",route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==="/levytate/login"&&request.method()==="GET")observations.publicLoginGets++;if(url.pathname==="/api/levytate-auth/request"&&request.method()==="POST"){authPosts++;return route.abort();}return[app,probe].includes(url.origin)?route.continue():route.abort();});
 stage="actual recovery modal";await page.goto(probe);const dialog=page.getByRole("dialog",{name:"Update awaiting confirmation",exact:true});await dialog.waitFor();const button=dialog.getByRole("button",{name:"Sign in in new tab",exact:true});assert(await button.isEnabled());
 stage="click recovery button";const next=context.waitForEvent("page").catch(error=>({safeError:error}));await button.click();observations.clickCompleted=true;stage="await context popup";const popup=await next;if(popup.safeError)throw popup.safeError;popup.setDefaultTimeout(10000);
 stage="real public login form";await popup.getByRole("textbox",{name:"Work email",exact:true}).waitFor();const location=new URL(popup.url());assert.equal(location.origin,app);assert.equal(location.pathname,"/levytate/login");assert.equal(authPosts,0);assert(await dialog.isVisible());assert.equal(await page.getByRole("textbox",{name:"Retained answer",exact:true,includeHidden:true}).inputValue(),"Synthetic original answer");
 stage="close before an expected response";const abandoned=observeBrowserEvent(popup.waitForResponse(response=>new URL(response.url()).pathname==="/never-requested"));await popup.close();assert((await abandoned).error instanceof Error);
 console.log(JSON.stringify({result:"PASS",kind:"actual-recovery-components-and-public-login-GET-not-authentication-proof",browserVersion:browser.version(),assertions:7,authRequests:authPosts,observations}));await context.close();
}catch(error){console.log(JSON.stringify({result:"FAIL",safeStage:stage,safeErrorClass:["TimeoutError","TypeError"].includes(error?.name)?error.name:"Error",authRequests:authPosts,observations}));process.exitCode=1;}
finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
