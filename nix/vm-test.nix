{
  self,
  testers,
  writeTextDir,
}:

testers.runNixOSTest {
  name = "bauble";

  nodes.machine = {
    imports = [ self.nixosModules.default ];
    services.bauble = {
      enable = true;
      url = "http://machine";
    };
    # an internal service behind a public-looking name, as after a DNS rebind
    networking.interfaces.eth1.ipv4.addresses = [
      {
        address = "192.168.77.1";
        prefixLength = 24;
      }
    ];
    networking.hosts."192.168.77.1" = [ "shop.example.com" ];
    services.nginx = {
      enable = true;
      virtualHosts."shop.example.com".root = writeTextDir "index.html" "<title>INTERNAL</title>";
    };
  };

  testScript = ''
    import json

    machine.wait_for_unit("bauble.service")
    machine.wait_for_unit("nginx.service")
    machine.wait_until_succeeds("curl -fs http://127.0.0.1:8090/api/health")
    machine.succeed("curl -fs http://127.0.0.1:8090/ -o /tmp/index.html && grep -qi '<html' /tmp/index.html")
    assert "INTERNAL" in machine.succeed("curl -fs http://shop.example.com/")

    out = machine.succeed("bauble-ctl invite admin Alex")
    token = out.split("http://machine/i/")[1].split()[0]
    body = json.dumps({"token": token, "name": "Alex", "email": "alex@example.com", "password": "password123"})
    auth = json.loads(machine.succeed(f"curl -fs -H 'Content-Type: application/json' -d '{body}' http://127.0.0.1:8090/api/bauble/join"))["token"]

    res = json.loads(machine.succeed(f"curl -fs -H 'Authorization: {auth}' 'http://127.0.0.1:8090/api/bauble/preview?url=http://shop.example.com/'"))
    assert res["ok"] is False and "INTERNAL" not in json.dumps(res), res

    # control: without the socket filter the same request reaches the internal page
    machine.succeed("systemctl set-property --runtime bauble.service IPAddressDeny=")
    machine.succeed("systemctl restart bauble.service")
    machine.wait_until_succeeds("curl -fs http://127.0.0.1:8090/api/health")
    res = json.loads(machine.succeed(f"curl -fs -H 'Authorization: {auth}' 'http://127.0.0.1:8090/api/bauble/preview?url=http://shop.example.com/'"))
    assert res["title"] == "INTERNAL", res
  '';
}
