package main

import (
	"crypto/rand"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
	libp2phttp "github.com/libp2p/go-libp2p/p2p/http"
	httpauth "github.com/libp2p/go-libp2p/p2p/http/auth"
)

func main() {
	privKey, _, err := crypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		log.Fatalf("failed to generate key: %v", err)
	}

	args := os.Args[1:]
	if len(args) == 1 && args[0] == "client" {
		log.Printf("client connecting to server on localhost:8001")
		err := runClient(privKey)
		if err != nil {
			log.Fatalf("client failed: %v", err)
		}
		return
	}

	err = runServer(privKey)
	if err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func runServer(privKey crypto.PrivKey) error {
	id, err := peer.IDFromPrivateKey(privKey)
	if err != nil {
		return err
	}
	fmt.Println("Server ID:", id)

	wellKnown := &libp2phttp.WellKnownHandler{}
	http.Handle(libp2phttp.WellKnownProtocols, wellKnown)
	auth := &httpauth.ServerPeerIDAuth{PrivKey: privKey, TokenTTL: time.Hour, NoTLS: true, ValidHostnameFn: func(hostname string) bool { return true }}
	http.Handle("/auth", auth)
	wellKnown.AddProtocolMeta(httpauth.ProtocolID, libp2phttp.ProtocolMeta{Path: "/auth"})
	auth.Next = func(clientID peer.ID, w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/log-my-id" {
			fmt.Println("Client ID:", clientID)
		}
		w.WriteHeader(200)
	}
	http.Handle("/log-my-id", auth)
	wellKnown.AddProtocolMeta("/log-my-id/1", libp2phttp.ProtocolMeta{Path: "/log-my-id"})

	log.Printf("server listening on :8001")
	return http.ListenAndServe("127.0.0.1:8001", nil)
}

func runClient(privKey crypto.PrivKey) error {
	log.Printf("run auth")
	auth := httpauth.ClientPeerIDAuth{PrivKey: privKey}
	log.Printf("run log")
	req, err := http.NewRequest("GET", "http://localhost:8001/log-my-id", nil)
	if err != nil {
		return err
	}
	log.Printf("auth do")
	serverID, _, err := auth.AuthenticatedDo(http.DefaultClient, req)
	if err != nil {
		return err
	}
	fmt.Println("Server ID:", serverID)

	myID, err := peer.IDFromPrivateKey(privKey)
	if err != nil {
		return err
	}
	fmt.Println("Client ID:", myID.String())

	return nil
}
