# Execution of fuzz tests 
- typically managed through a fuzzing framework or tool. 
- The specific commands and configurations may vary depending on the framework being used. 

Below are general steps to execute fuzz tests:

````nginx
cargo install cargo-fuzz
cargo install anchor-fuzz
````            
proceed:
````nginx
anchor-fuzz fuzz fuzz_init_sol.rs
anchor-fuzz fuzz fuzz_release_sol
anchor-fuzz fuzz fuzz_invalid_pda
````

If CI Automation is required, please refer to the following example of a GitHub Actions workflow file that automates the execution of fuzz tests:

```yaml
name: Fuzzing
on:
  push:
  pull_request:

jobs:
  fuzz:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Install Dependencies
        run: |
          cargo install anchor-fuzz
      - name: Run Fuzzers
        run: |
          anchor-fuzz --help
          anchor-fuzz fuzz fuzz_init_sol --jobs 4 --time 60
          anchor-fuzz fuzz fuzz_release_sol --jobs 4 --time 60
          anchor-fuzz fuzz fuzz_invalid_pda --jobs 4 --time 60
````

