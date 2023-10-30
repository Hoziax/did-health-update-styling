///<reference path="../../../node_modules/@types/fhir/index.d.ts"/>
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useScaffoldContractWrite } from "../hooks/scaffold-eth";
import { makeStorageClient } from "../hooks/useIpfs";
import { useAccount, useNetwork } from "wagmi";
import Patient = fhir4.Patient;
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { ethConnect } from '@lit-protocol/lit-node-client';
import {  ExternalProvider, Web3Provider } from '@ethersproject/providers';
import Button from "../components/Button";
import { v4 } from "uuid";
import dynamic from 'next/dynamic';

// Dynamically import the ShareModal component
const ShareModal = dynamic(() => import('lit-share-modal-v3'), {
  ssr: false, // This will load the component only on the client side
});
import { AccessControlConditions, AccsRegularParams } from '@lit-protocol/types'; //Chain, ConditionType, EvmContractConditions, IRelayAuthStatus, JsonRequest, LIT_NETWORKS_KEYS, SolRpcConditions, SymmetricKey, UnifiedAccessControlConditions are also available
const PatientForm: React.FC = () => {
  const [patient, setPatient] = useState<Patient>({
    resourceType: 'Patient',
    id: '',
    name: [{ given: [], family: '' }],
    gender: 'unknown',
    birthDate: '',
    telecom: [{ use: 'home' }, { system: 'phone', value: '' }, { system: 'email', value: '' }],
    address: [{ line: [], city: '', state: '', postalCode: '', country: '' }],
    identifier: [{ system: 'https://www.w3.org/ns/did', value: '' }, { type: { coding: [{ code: '', system: 'http://terminology.hl7.org/CodeSystem/v2-0203' }] } }],
  });
  const account = useAccount();
  const { address: publicKey } = useAccount();
  const { chain, chains } = useNetwork();
  const chainId = chain?.id;
  let chainIdString = "";
  if (chainId && chainId < 100000) {
    chainIdString = String(chainId).padStart(6, "0");
  }
  const [hasCreatedProfile, setHasCreatedProfile] = useState(false);
  const [uri, setUri] = useState("");
  const [didsuffix, setDIDSuffix] = useState<string>("");
  const [did, setDID] = useState<string>("");
  const [authSig, setAuthSig] = useState({sig: '', derivedVia: '', signedMessage: '', address: ''});
  const [showShareModal, setShowShareModal] = useState(false);
  const [provider, setProvider] = useState<Web3Provider>();
  //const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [thisPublicKey] = useState(publicKey);
  const [accessControlConditions, setAccessControlConditions] = useState<AccessControlConditions[]>([]);
  const [error, setError] = useState<any>(null);
  useEffect(() => {
    let ethereum: ExternalProvider;
    if (typeof window !== "undefined") {
        ethereum = (window as any).ethereum;
        const providerInstance = new Web3Provider(ethereum);
        setProvider(providerInstance);
        const client = new LitJsSdk.LitNodeClient({litNetwork: 'cayenne'});
        client.connect();
        window.LitNodeClient = client;
    }
}, []);  // Empty dependency array ensures this runs once after component mounts

  
  const generateAuthSig = useCallback(async () => {
    if (publicKey != null && provider) {
        const authSig = await ethConnect.signAndSaveAuthMessage({
            web3: provider,
            account: publicKey.toLowerCase(),
            chainId: 5,
            resources: {},
            expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        });
        setAuthSig(authSig);
        console.log(authSig);
    }
  }, [publicKey, provider, setAuthSig]);

  useEffect(() => {
      if (publicKey) {
          generateAuthSig();
      }
  }, [publicKey, generateAuthSig]);
  const onUnifiedAccessControlConditionsSelected = (shareModalOutput: any) => {
    // Since shareModalOutput is already an object, no need to parse it
    // Check if shareModalOutput has the property "unifiedAccessControlConditions" and it's an array
    if (shareModalOutput.hasOwnProperty("unifiedAccessControlConditions") && Array.isArray(shareModalOutput.unifiedAccessControlConditions)) {
      setAccessControlConditions(shareModalOutput.unifiedAccessControlConditions);
    } else {
      // Handle the case where "unifiedAccessControlConditions" doesn't exist or isn't an array
      console.error("Invalid shareModalOutput: missing unifiedAccessControlConditions array");
    }  
    setShowShareModal(false);
  };  
  const handleDIDChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setDIDSuffix(value); // Assuming value contains the new suffix
    setDID((prevDID) => {
      return 'did:health:' + chainIdString + value;
    });
  }
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setPatient((prevPatient) => {
      const updatedPatient = { ...prevPatient };

      const keys = name.split('.');
      let current = updatedPatient;

      for (let i = 0; i < keys.length; i++) {
        if (i === keys.length - 1) {
          // Handle the last level of nesting
          if (Array.isArray((current as any)[keys[i]])) {
            // If it's an array, create a new array with the updated value
            (current as any)[keys[i]] = [value];
          } else {
            (current as any)[keys[i]] = value;
          }
        } else {
          // Create nested objects if they don't exist
          if (!(current as any)[keys[i]]) {
            (current as any)[keys[i]] = Array.isArray(keys[i + 1]) ? [] : {};
          }
          current = (current as any)[keys[i]];
        }
      }

      return updatedPatient;
    });
  };
  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const updatedPatient = { ...patient };  // Make a copy
    if (updatedPatient.identifier && updatedPatient.identifier[0]) {
        updatedPatient.identifier[0].value = did;
    }
    const uuid = v4();
    updatedPatient.id = uuid;
    setPatient(updatedPatient);  // Set the updated state
    //Add the current user to the accessControlCoditions
    const userSelfCondition = {
      chain: "ethereum",
      conditionType: "evmBasic",
      contractAddress: "",
      method: "",
      parameters: [':userAddress'],
      returnValueTest : {comparator: '=', value: publicKey} ,
      standardContractType :  ""
    }
    if (thisPublicKey) {
      //Add the current user to the accessControlCoditions
      const userSelfCondition : AccessControlConditions = [{
        chain: "ethereum",
        conditionType: "evmBasic",
        contractAddress: "",
        method: "",
        parameters: [':userAddress'],
        returnValueTest : {comparator: '=', value: thisPublicKey} ,
        standardContractType :  ""
      }]
      setAccessControlConditions(prevConditions => [...prevConditions, userSelfCondition]);
      console.log(accessControlConditions)
      //downloadJson(patient, uuid);
      console.log("downloaded file");
      const JSONpatient = JSON.stringify(patient)
      const blob = new Blob([JSONpatient], { type: "application/json" });
      console.log("created blob");
      
      const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptFile(
        {
          accessControlConditions: accessControlConditions[0],
          authSig: authSig,
          chain: chainIdString,
          file: blob,
        },
        window.LitNodeClient 
      );
      const hash = dataToEncryptHash;
      console.log("executed encytption with lit:" + hash);
      const encFile = ciphertext;
      console.log("File encrypted with Lit protocol:" + encFile);
      if (encFile != null) {
        const files = [new File([encFile], "Patient/" + uuid)];
        //Upload File to IPFS
        const client = makeStorageClient();
        const cid = await client.put(files);
        console.log(cid)
        const uri = "https://" + cid + ".ipfs.dweb.link/Patient/" + uuid + "?encHash=" + dataToEncryptHash;
        console.log(uri)
        //create new did registry entry
        console.log("stored files with cid:", cid);
        console.log("uri:", uri);
        setHasCreatedProfile(true);
        setUri(uri);
        return uri;
      }
    }
  };
  const downloadJson = (object: Patient, filename: string) => {
    const blob = new Blob([JSON.stringify(object)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const { writeAsync, isLoading } = useScaffoldContractWrite({
    contractName: "HealthDIDRegistry",
    functionName: "registerDID",
    args: [chainIdString + didsuffix, uri],
    blockConfirmations: 10,
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });
  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-lg">
      <div className="form-group">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            DID Name:
          </label>
          <input
            type="text"
            name="didsuffix"
            value={didsuffix}
            onChange={handleDIDChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          <label>Your DID is (will be) : </label>
          <input
            type="text"
            name="did"
            value={did}
            readOnly
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      </div>
      <div className="form-group">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            First Name:
          </label>
          <input
            type="text"
            name="name.0.given.0"
            value={patient.name?.[0].given?.[0]}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Last Name:
          </label>
          <input
            type="text"
            name="name.0.family"
            value={patient.name?.[0].family}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      </div>
      <div className="form-group">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Gender:
          </label>
          <select
            name="gender"
            value={patient.gender}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Birth Date:
          </label>
          <input
            type="date"
            name="birthDate"
            value={patient.birthDate}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      </div>
      <div className="form-group">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Telephone Number:
          </label>
          <input
            type="tel"
            name="telecom.1.value"
            value={patient.telecom?.[1]?.value || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Email Address:
          </label>
          <input
            type="email"
            name="telecom.2.value"
            value={patient.telecom?.[2]?.value || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      </div>
      <div className="form-group">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Address Line:
          </label>
          <input
            type="text"
            name="address.0.line.0"
            value={patient.address?.[0]?.line?.[0] || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            City:
          </label>
          <input
            type="text"
            name="address.0.city"
            value={patient.address?.[0]?.city || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            State:
          </label>
          <input
            type="text"
            name="address.0.state"
            value={patient.address?.[0]?.state || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Postal Code:
          </label>
          <input
            type="text"
            name="address.0.postalCode"
            value={patient.address?.[0]?.postalCode || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Country:
          </label>
          <input
            type="text"
            name="address.0.country"
            value={patient.address?.[0]?.country || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      </div>
      <div className="form-group">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Identifier Type:
          </label>
          <select
            name="identifier.1.type.coding.0.code"
            value={patient.identifier?.[1].type?.coding?.[0].code || ''}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Select an identifier type</option>
            <option value="DL">Driver&apos;s License Number</option>
            <option value="MR">Medical Record Number</option>
            <option value="SSN">Social Security Number</option>
            {/* Add more options as needed */}
          </select>

        </div>
        <div> <input
          type="text"
          name="identifier.1.value"
          value={patient.identifier?.[1].value || ''}
          onChange={handleInputChange}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        /></div>
      </div>
      <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Access Control (Who Can Read your Patient Profile):
          </label>
          <Button
            btnType="submit"
            title=" Access Control"
            styles="bg-[#f71b02] text-white"
            handleClick={() => {
              setShowShareModal(true);
            }}
          />
        </div>
      <div>
        {showShareModal &&  (
          <div className={"lit-share-modal"}>
            <ShareModal
              onClose={() => setShowShareModal(false)}
              onUnifiedAccessControlConditionsSelected={
                onUnifiedAccessControlConditionsSelected
              }
            />
          </div>
        )}
      </div>
      <div className="flex justify-center items-center">
        {!hasCreatedProfile && !uri ? (
          <Button
            btnType="submit"
            title="Create DID Patient"
            styles="bg-[#f71b02] text-white"
            handleClick={() => {
              handleSubmit;
            }}
          />
        ) : (
          <Button
            btnType="submit"
            title="Register DID"
            styles="bg-[#f71b02] text-white"
            handleClick={() => {
              writeAsync();
            }}
          />
        )}
      </div>    
    </form>
  );
};
export default PatientForm;

