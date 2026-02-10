{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    crane.url = "github:ipetkov/crane";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, crane, rust-overlay, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ (import rust-overlay) ];
      };

      rustToolchain = pkgs.rust-bin.stable."1.93.0".minimal;

      craneLib = (crane.mkLib pkgs).overrideToolchain rustToolchain;

      # Filter source to only include Rust-relevant files
      src = craneLib.cleanCargoSource ./.;

      commonArgs = {
        inherit src;
        strictDeps = true;

        # Native dependencies needed at build time
        nativeBuildInputs = with pkgs; [
          pkg-config
        ];

        buildInputs = with pkgs; [
          openssl
        ];
      };

      # Build only the cargo dependencies for caching
      cargoArtifacts = craneLib.buildDepsOnly commonArgs;

      # Build the full binary
      discord-bot = craneLib.buildPackage (commonArgs // {
        inherit cargoArtifacts;
      });

      # OCI image
      docker-image = pkgs.dockerTools.buildLayeredImage {
        name = "docker.local.kye.dev/discord-bot";
        tag = "latest";

        contents = [
          discord-bot
          pkgs.cacert
        ];

        config = {
          Entrypoint = [ "discord-bot" ];
        };
      };
    in
    {
      packages.${system} = {
        inherit discord-bot docker-image;
        default = discord-bot;
      };

      devShells.${system}.default = craneLib.devShell {
        inputsFrom = [ discord-bot ];

        packages = with pkgs; [
          rust-analyzer
          cargo-watch
        ];
      };
    };
}
