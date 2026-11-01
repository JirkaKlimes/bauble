{
  self,
  testers,
  writeTextDir,
}:

let
  # Internal services behind public-looking names, as after a DNS rebind or a redirect.
  machine =
    { nftables }:
    { pkgs, ... }:
    {
      imports = [ self.nixosModules.default ];
      services.bauble = {
        enable = true;
        url = "http://machine";
      };
      networking.nftables.enable = nftables;
      networking.interfaces.eth1.ipv4.addresses = [
        {
          address = "192.168.77.1";
          prefixLength = 24;
        }
      ];
      networking.hosts."192.168.77.1" = [ "shop.example.com" ];
      networking.hosts."127.0.0.1" = [ "loop.example.com" ];
      services.nginx = {
        enable = true;
        virtualHosts."shop.example.com".root = writeTextDir "index.html" "<title>INTERNAL</title>";
        virtualHosts."loop.example.com".root = writeTextDir "index.html" "<title>LOOPBACK</title>";
      };
      # a resolver on loopback, like systemd-resolved: DNS must keep working
      networking.nameservers = [ "127.0.0.1" ];
      services.dnsmasq = {
        enable = true;
        resolveLocalQueries = false;
        settings = {
          listen-address = "127.0.0.1";
          bind-interfaces = true;
          address = "/dns.example.org/203.0.113.7";
        };
      };
      environment.systemPackages = [ pkgs.curl ];
    };
in
testers.runNixOSTest {
  name = "bauble";

  nodes.iptables = machine { nftables = false; };
  nodes.nftables = machine { nftables = true; };

  testScript = ''
    import json

    def preview(m, auth, url):
        return json.loads(m.succeed(f"curl -fs -H 'Authorization: {auth}' 'http://127.0.0.1:8090/api/bauble/preview?url={url}'"))

    def check(m, open_egress):
        m.wait_for_unit("bauble.service")
        m.wait_for_unit("nginx.service")
        m.wait_until_succeeds("curl -fs http://127.0.0.1:8090/api/health")
        m.succeed("curl -fs http://127.0.0.1:8090/ -o /tmp/index.html && grep -qi '<html' /tmp/index.html")
        assert "INTERNAL" in m.succeed("curl -fs http://shop.example.com/")
        assert "LOOPBACK" in m.succeed("curl -fs http://loop.example.com/")

        out = m.succeed("bauble-ctl invite admin Alex")
        token = out.split("http://machine/i/")[1].split()[0]
        body = json.dumps({"token": token, "name": "Alex", "email": "alex@example.com", "password": "password123"})
        auth = json.loads(m.succeed(f"curl -fs -H 'Content-Type: application/json' -d '{body}' http://127.0.0.1:8090/api/bauble/join"))["token"]

        # the service user still resolves names, but cannot open loopback connections
        assert "203.0.113.7" in m.succeed("runuser -u bauble -- getent hosts dns.example.org")
        m.fail("runuser -u bauble -- curl -s -m 3 http://127.0.0.1/")
        for url in ("http://shop.example.com/", "http://loop.example.com/"):
            res = preview(m, auth, url)
            assert res["ok"] is False and "INTERNAL" not in json.dumps(res) and "LOOPBACK" not in json.dumps(res), (url, res)

        # controls: without the filters the same requests reach the internal pages
        open_egress(m)
        m.succeed("systemctl set-property --runtime bauble.service IPAddressDeny=")
        m.succeed("systemctl restart bauble.service")
        m.wait_until_succeeds("curl -fs http://127.0.0.1:8090/api/health")
        assert preview(m, auth, "http://shop.example.com/")["title"] == "INTERNAL"
        assert preview(m, auth, "http://loop.example.com/")["title"] == "LOOPBACK"

    start_all()
    check(iptables, lambda m: m.succeed("iptables -F bauble-egress"))
    check(nftables, lambda m: m.succeed("nft flush chain inet bauble-egress output"))
  '';
}
