    #![cfg_attr(not(any(feature = "library", test)), no_std)]
    #![cfg_attr(not(test), no_main)]

    
    #[cfg(any(feature = "library", test))]
    extern crate alloc;
    
    #[cfg(not(any(feature = "library", test)))]
    ckb_std::entry!(program_entry);
    
    #[cfg(not(any(feature = "library", test)))]
    ckb_std::default_alloc!(16384, 1258306, 64);
    
    use ckb_std::{
        ckb_constants::Source,
        high_level::{load_script, load_cell_lock},
        ckb_types::prelude::*,
        error::SysError
    };

    pub enum Error {
        LockChanged = 1,
        Syscall = 2
    }

    pub fn program_entry() -> i8 {
        match main() {
            Ok(_) => 0,
            Err(error) => error as i8
        }
    }

    pub fn main() -> Result<(), Error>{
        let current_script = load_script().map_err(|_| Error::Syscall)?;

        let current_lock_hash = current_script.calc_script_hash();

        let mut index = 0;

        loop {
            match load_cell_lock(index, Source::Output) {
                Ok(output_lock) => {
                    let output_lock_hash = output_lock.calc_script_hash();

                    if output_lock_hash.as_slice() == current_lock_hash.as_slice() {
                        return Ok(());
                    }

                    index += 1;
                }

                Err(SysError::IndexOutOfBound) => {
                    return Err(Error::LockChanged);
                }

                Err(_) => {
                    return Err(Error::Syscall);
                }
            }
        }
    }
    