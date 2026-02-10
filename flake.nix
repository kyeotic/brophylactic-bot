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

      rustToolchain = pkgs.rust-bin.stable."1.93.0".minimal.override {
        targets = [ "x86_64-unknown-linux-musl" ];
      };

      craneLib = (crane.mkLib pkgs).overrideToolchain rustToolchain;

      # Filter source to only include Rust-relevant files
      src = craneLib.cleanCargoSource ./.;

      commonArgs = {
        inherit src;
        strictDeps = true;

        CARGO_BUILD_TARGET = "x86_64-unknown-linux-musl";
        CARGO_BUILD_RUSTFLAGS = "-C target-feature=+crt-static";

        # Size optimizations (only for nix image builds, not local/Docker dev)
        CARGO_PROFILE_RELEASE_LTO = "true";
        CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1";
        CARGO_PROFILE_RELEASE_OPT_LEVEL = "z";
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
