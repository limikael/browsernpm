npmRepo=new NpmRepo();
npmRepo.getSatisfyingVersion(name, version);
npmRepo.getDependencies(name, version);
npmRepo.install(name, version, target);


c=new Cache();
c.